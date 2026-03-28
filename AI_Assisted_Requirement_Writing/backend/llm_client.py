"""
llm_client.py
Module for communicating with Ollama LLM service for requirements generation.
"""
import ollama
import json
import time
from typing import Dict, List, Optional, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class LLMClient:
    def __init__(self, model_name: str = "llama3.2:3b"):
        """Initialize LLM client with specified model"""
        self.model_name = model_name
        self.client = ollama.Client()
        
    def check_model_availability(self) -> bool:
        """Check if the specified model is available"""
        try:
            models = self.client.list()
            available_models = [model['name'] for model in models['models']]
            return self.model_name in available_models
        except Exception as e:
            logger.error(f"Error checking model availability: {e}")
            return False
    
    def check_ollama_connection(self) -> bool:
        """Check if Ollama service is running"""
        try:
            self.client.list()
            return True
        except Exception as e:
            logger.error(f"Error connecting to Ollama: {e}")
            return False
    
    def generate_response(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """Generate response from LLM with retry logic"""
        for attempt in range(max_retries):
            try:
                response = self.client.generate(
                    model=self.model_name,
                    prompt=prompt,
                    options={
                        'temperature': 0.3,  # Lower temperature for more consistent output
                        'top_p': 0.9,
                        'max_tokens': 2000
                    }
                )
                raw_response = response['response'].strip()
                
                # Clean response - remove markdown code blocks and extra text
                if '```json' in raw_response:
                    # Extract JSON from markdown code block
                    start = raw_response.find('```json') + 7
                    end = raw_response.find('```', start)
                    if end != -1:
                        json_text = raw_response[start:end].strip()
                        return json_text
                elif '```' in raw_response:
                    # Extract content from any code block
                    start = raw_response.find('```') + 3
                    end = raw_response.find('```', start)
                    if end != -1:
                        json_text = raw_response[start:end].strip()
                        return json_text
                elif '{' in raw_response:
                    # Find first { and extract JSON from there
                    start = raw_response.find('{')
                    if start != -1:
                        json_text = raw_response[start:].strip()
                        return json_text
                
                # Return cleaned response
                return raw_response
                
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    logger.error(f"All {max_retries} attempts failed")
                    return None
    
    def generate_functional_requirements(self, entities: Dict, actions: List[str], keywords: List[str], context: str) -> List[Dict]:
        """Generate functional requirements based on extracted information"""
        prompt = f"""
You are a requirements engineering expert. Generate ONLY FUNCTIONAL requirements based on the extracted information.

FUNCTIONAL REQUIREMENTS define WHAT the system must do - specific behaviors, features, and capabilities.

CONTEXT:
{context}

EXTRACTED INFORMATION:
- Systems/Entities: {entities}
- Action Verbs: {actions}
- Key Terms: {keywords}

Generate 5-8 FUNCTIONAL requirements following these examples:
- The system shall allow users to create an account.
- Users shall be able to search for products by category.
- The application shall provide a shopping cart for users to add items.
- The system shall process payments securely.
- Users shall be able to track their order status.

IMPORTANT: Focus on ACTIONS and FEATURES, NOT performance or security characteristics.

Requirements should be:
- Specific actions the system performs
- User-facing capabilities
- Business functionalities
- Feature-based descriptions

DO NOT include:
- Performance metrics (response time, speed)
- Security specifications (encryption, authentication)
- Usability descriptions (easy to use, interface)
- Reliability requirements (uptime, availability)

Return only a JSON array with this structure:
{{
    "functional_requirements": [
        {{
            "id": "FR-001",
            "description": "The system shall allow users to create an account.",
            "priority": "High",
            "category": "User Account Management"
        }}
    ]
}}
"""
        
        response = self.generate_response(prompt)
        if response:
            try:
                # Clean response - find the main JSON object
                cleaned_response = response.strip()
                
                # Find the start and end of the main JSON object
                start_idx = cleaned_response.find('{')
                if start_idx == -1:
                    logger.error("No JSON object found in response")
                    return []
                
                # Count braces to find the matching closing brace
                brace_count = 0
                for i, char in enumerate(cleaned_response[start_idx:], start_idx):
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            # Found the matching closing brace
                            cleaned_response = cleaned_response[start_idx:i+1]
                            break
                
                # Parse JSON response
                result = json.loads(cleaned_response)
                return result.get('functional_requirements', [])
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse LLM response as JSON: {e}")
                logger.error(f"Response was: {response}")
                return []
        return []
    
    def generate_non_functional_requirements(self, keywords: List[str], context: str, entities: Dict) -> List[Dict]:
        """Generate non-functional requirements (performance, security, usability, etc.)"""
        prompt = f"""
You are a requirements engineering expert. Generate ONLY NON-FUNCTIONAL requirements based on the extracted information.

NON-FUNCTIONAL REQUIREMENTS define HOW the system performs - quality attributes and constraints.

CONTEXT:
{context}

KEY TERMS: {keywords}
ENTITIES: {entities}

Generate 5-8 NON-FUNCTIONAL requirements in these specific categories:

PERFORMANCE:
- Response time, throughput, capacity
- Example: "The system shall respond to user requests within 2 seconds."
- Example: "The system shall handle 1000 concurrent users."

SECURITY:
- Data protection, access control, encryption
- Example: "The system shall encrypt all sensitive user data."
- Example: "The system shall implement secure authentication."

USABILITY:
- Ease of use, learnability, accessibility
- Example: "The system shall provide an intuitive user interface."
- Example: "The system shall be accessible to users with disabilities."

RELIABILITY:
- Availability, error handling, recovery
- Example: "The system shall be available 99.9% of the time."
- Example: "The system shall recover from failures within 5 minutes."

IMPORTANT: Focus on QUALITY ATTRIBUTES, NOT specific features or actions.

DO NOT include:
- User actions or features (create account, search, etc.)
- Business functionalities
- System behaviors

Return only a JSON array with this structure:
{{
    "non_functional_requirements": [
        {{
            "id": "NFR-001",
            "description": "The system shall respond to user requests within 2 seconds.",
            "priority": "High",
            "category": "Performance"
        }}
    ]
}}
"""
        
        response = self.generate_response(prompt)
        if response:
            try:
                result = json.loads(response)
                return result.get('non_functional_requirements', [])
            except json.JSONDecodeError:
                logger.error("Failed to parse LLM response as JSON")
                return []
        return []
    
    def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status"""
        status = {
            "ollama_connected": False,
            "model_available": False,
            "model_name": self.model_name,
            "error": None
        }
        
        if not self.check_ollama_connection():
            status["error"] = "Ollama service is not running"
            return status
        
        status["ollama_connected"] = True
        
        if not self.check_model_availability():
            status["error"] = f"Model '{self.model_name}' is not available"
            return status
        
        status["model_available"] = True
        return status


# Test function
if __name__ == "__main__":
    client = LLMClient()
    
    # Check system status
    status = client.get_system_status()
    print("=== LLM System Status ===")
    print(json.dumps(status, indent=2))
    
    if status["model_available"]:
        # Test simple generation
        test_prompt = "Generate a simple software requirement for user login."
        response = client.generate_response(test_prompt)
        print(f"\nTest Response: {response}")
