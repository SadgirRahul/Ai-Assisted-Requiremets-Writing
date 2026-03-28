"""
requirements_generator.py
Module for generating structured requirements from NLP analysis using LLM.
"""
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import json
import uuid
from datetime import datetime
from llm_client import LLMClient

@dataclass
class Requirement:
    """Structure for individual requirements"""
    id: str
    type: str  # "functional" or "non-functional"
    description: str
    priority: str  # "High", "Medium", "Low"
    category: str
    source: str  # "LLM-generated" or "extracted"
    created_at: str
    
    def to_dict(self) -> Dict:
        """Convert requirement to dictionary"""
        return {
            "id": self.id,
            "type": self.type,
            "description": self.description,
            "priority": self.priority,
            "category": self.category,
            "source": self.source,
            "created_at": self.created_at
        }

class RequirementsGenerator:
    def __init__(self, llm_client: LLMClient):
        """Initialize requirements generator with LLM client"""
        self.llm_client = llm_client
        self.req_counter = {"FR": 0, "NFR": 0}  # Functional/Non-functional requirement counters
    
    def generate_requirement_id(self, req_type: str) -> str:
        """Generate unique requirement ID"""
        prefix = "FR" if req_type == "functional" else "NFR"
        self.req_counter[prefix] += 1
        return f"{prefix}-{self.req_counter[prefix]:03d}"
    
    def determine_priority(self, description: str, keywords: List[str]) -> str:
        """Determine requirement priority based on keywords and content"""
        description_lower = description.lower()
        keywords_lower = [kw.lower() for kw in keywords]
        
        high_priority_keywords = ['security', 'authentication', 'critical', 'must', 'essential', 'core']
        medium_priority_keywords = ['should', 'important', 'significant', 'key']
        
        # Check for high priority indicators
        if any(kw in description_lower for kw in high_priority_keywords):
            return "High"
        
        # Check for medium priority indicators
        if any(kw in description_lower for kw in medium_priority_keywords):
            return "Medium"
        
        # Check keyword overlap
        if any(kw in description_lower for kw in keywords_lower):
            return "Medium"
        
        return "Low"
    
    def categorize_requirement(self, description: str, req_type: str) -> str:
        """Categorize requirement based on description content"""
        description_lower = description.lower()
        
        if req_type == "functional":
            # Functional categories - WHAT the system does
            categories = {
                "User Account Management": ['user', 'account', 'login', 'register', 'profile', 'create account'],
                "Product Catalog": ['product', 'catalog', 'item', 'browse', 'search product', 'filter'],
                "Shopping Cart": ['cart', 'add to cart', 'remove from cart', 'shopping cart', 'wishlist'],
                "Order Management": ['order', 'place order', 'order tracking', 'order history', 'purchase'],
                "Payment Processing": ['payment', 'checkout', 'transaction', 'pay', 'billing'],
                "Inventory Management": ['inventory', 'stock', 'warehouse', 'manage stock'],
                "Customer Service": ['support', 'help', 'customer service', 'contact', 'complaint'],
                "Content Management": ['content', 'manage', 'create', 'edit', 'publish', 'delete'],
                "Reporting & Analytics": ['report', 'analytics', 'dashboard', 'statistics', 'export'],
                "Communication": ['notification', 'email', 'message', 'alert', 'notify', 'sms'],
                "Search & Navigation": ['search', 'browse', 'navigate', 'find', 'filter'],
                "Data Management": ['data', 'store', 'save', 'retrieve', 'delete', 'update', 'record']
            }
        else:
            # Non-functional categories - HOW the system performs
            categories = {
                "Performance": ['response time', 'speed', 'time', 'performance', 'fast', 'slow', 'within', 'seconds', 'concurrent', 'load', 'capacity'],
                "Security": ['security', 'secure', 'protect', 'encrypt', 'authentication', 'authorization', 'protect data', 'privacy', 'confidential'],
                "Usability": ['easy', 'simple', 'intuitive', 'user-friendly', 'accessible', 'interface', 'design', 'experience'],
                "Reliability": ['available', 'reliable', 'stable', 'uptime', 'error handling', 'recovery', 'backup', 'failover'],
                "Scalability": ['scale', 'scalability', 'concurrent users', 'multiple users', 'load balancing', 'handle'],
                "Maintainability": ['maintain', 'update', 'modify', 'extend', 'document', 'code quality', 'testing'],
                "Data Privacy": ['data privacy', 'privacy', 'personal information', 'data protection', 'compliance'],
                "System Availability": ['24/7', 'availability', 'downtime', 'maintenance', 'operational'],
                "Integration": ['integration', 'api', 'third party', 'external system', 'interface'],
                "Compliance": ['compliance', 'regulation', 'standards', 'audit', 'legal']
            }
        
        # Find best matching category
        best_category = "General"
        best_score = 0
        
        for category, keywords in categories.items():
            score = sum(1 for keyword in keywords if keyword in description_lower)
            if score > best_score:
                best_score = score
                best_category = category
        
        return best_category
    
    def process_llm_requirements(self, llm_requirements: List[Dict], req_type: str, keywords: List[str]) -> List[Requirement]:
        """Process LLM-generated requirements into structured format"""
        processed_requirements = []
        
        for req_data in llm_requirements:
            try:
                # Generate requirement ID
                req_id = self.generate_requirement_id(req_type)
                
                # Extract description
                description = req_data.get('description', '').strip()
                if not description:
                    continue
                
                # Determine priority
                priority = req_data.get('priority', self.determine_priority(description, keywords))
                
                # Categorize requirement
                category = req_data.get('category', self.categorize_requirement(description, req_type))
                
                # Create requirement object
                requirement = Requirement(
                    id=req_id,
                    type=req_type,
                    description=description,
                    priority=priority,
                    category=category,
                    source="LLM-generated",
                    created_at=datetime.now().isoformat()
                )
                
                processed_requirements.append(requirement)
                
            except Exception as e:
                print(f"Error processing requirement: {e}")
                continue
        
        return processed_requirements
    
    def generate_functional_requirements(self, entities: Dict, actions: List[str], keywords: List[str], context: str) -> List[Requirement]:
        """Generate functional requirements using LLM"""
        print("Generating functional requirements...")
        
        # Get requirements from LLM
        llm_requirements = self.llm_client.generate_functional_requirements(
            entities=entities,
            actions=actions,
            keywords=keywords,
            context=context
        )
        
        if not llm_requirements:
            print("No functional requirements generated")
            return []
        
        # Process and structure requirements
        processed_reqs = self.process_llm_requirements(llm_requirements, "functional", keywords)
        print(f"Generated {len(processed_reqs)} functional requirements")
        
        return processed_reqs
    
    def generate_non_functional_requirements(self, keywords: List[str], context: str, entities: Dict) -> List[Requirement]:
        """Generate non-functional requirements using LLM"""
        print("Generating non-functional requirements...")
        
        # Get requirements from LLM
        llm_requirements = self.llm_client.generate_non_functional_requirements(
            keywords=keywords,
            context=context,
            entities=entities
        )
        
        if not llm_requirements:
            print("No non-functional requirements generated")
            return []
        
        # Process and structure requirements
        processed_reqs = self.process_llm_requirements(llm_requirements, "non-functional", keywords)
        print(f"Generated {len(processed_reqs)} non-functional requirements")
        
        return processed_reqs
    
    def generate_all_requirements(self, nlp_analysis: Dict, context: str) -> Dict[str, List[Requirement]]:
        """Generate all requirements from NLP analysis"""
        print("\nStarting requirements generation...")
        
        # Extract NLP analysis components
        entities = nlp_analysis.get('entities', {})
        keywords = nlp_analysis.get('keywords', [])
        actions = nlp_analysis.get('actions', [])
        
        # Generate functional requirements
        functional_reqs = self.generate_functional_requirements(
            entities=entities,
            actions=actions,
            keywords=keywords,
            context=context
        )
        
        # Generate non-functional requirements
        non_functional_reqs = self.generate_non_functional_requirements(
            keywords=keywords,
            context=context,
            entities=entities
        )
        
        return {
            "functional": functional_reqs,
            "non_functional": non_functional_reqs
        }
    
    def format_requirements_output(self, requirements: Dict[str, List[Requirement]]) -> Dict:
        """Format requirements for structured output"""
        output = {
            "summary": {
                "total_requirements": sum(len(reqs) for reqs in requirements.values()),
                "functional_count": len(requirements.get("functional", [])),
                "non_functional_count": len(requirements.get("non_functional", [])),
                "categories": {},
                "priorities": {"High": 0, "Medium": 0, "Low": 0}
            },
            "requirements": {
                "functional": [req.to_dict() for req in requirements.get("functional", [])],
                "non_functional": [req.to_dict() for req in requirements.get("non_functional", [])]
            }
        }
        
        # Calculate category and priority statistics
        all_reqs = requirements.get("functional", []) + requirements.get("non_functional", [])
        for req in all_reqs:
            # Category count
            category = req.category
            if category not in output["summary"]["categories"]:
                output["summary"]["categories"][category] = 0
            output["summary"]["categories"][category] += 1
            
            # Priority count
            priority = req.priority
            if priority in output["summary"]["priorities"]:
                output["summary"]["priorities"][priority] += 1
        
        return output


# Test function
if __name__ == "__main__":
    from llm_client import LLMClient
    
    # Test the requirements generator
    llm_client = LLMClient()
    generator = RequirementsGenerator(llm_client)
    
    # Sample NLP analysis
    sample_nlp = {
        "entities": {"SYSTEM": ["Online Shopping System"]},
        "keywords": ["user", "security", "performance", "order"],
        "actions": ["create", "browse", "place"]
    }
    
    sample_context = "The system should allow users to create accounts and browse products."
    
    # Generate requirements
    requirements = generator.generate_all_requirements(sample_nlp, sample_context)
    output = generator.format_requirements_output(requirements)
    
    print("=== Generated Requirements ===")
    print(json.dumps(output, indent=2))
