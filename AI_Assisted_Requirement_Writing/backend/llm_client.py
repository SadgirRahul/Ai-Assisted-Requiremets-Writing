"""
llm_client.py
OpenRouter (OpenAI-compatible) API client for requirements generation.
"""
import json
import os
import time
from typing import Any, Dict, List, Optional

import httpx
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_MODEL = "qwen/qwen3-8b"

# Injected into user prompts so priorities are varied and meaningful (not all "High").
PRIORITY_RULES_BLOCK = """
PRIORITY RULES (each requirement MUST have exactly one of: "High", "Medium", "Low"):

- High: Use only for regulatory/legal/safety-critical, security that prevents breach or fraud,
  authentication/authorization for protected data, payments/settlement, or capabilities the CONTEXT
  marks as mandatory/critical/essential (e.g. "must", "shall not launch without").
- Medium: Important for correct operation or major user value, but not catastrophic if phased
  (e.g. core workflows, reporting, most integrations).
- Low: Nice-to-have, cosmetic, optional enhancements, or lower business risk items.

DISTRIBUTION: Across this batch, at most about 40% of items may be High unless the CONTEXT is
dominated by mandatory/legal/security language. Include at least one Medium and one Low when
you output 5 or more requirements. Do not label everything High.
"""


def _strip_json_fences(raw: str) -> str:
    """Remove markdown code fences and isolate JSON object text."""
    text = raw.strip()
    if "```json" in text:
        start = text.find("```json") + 7
        end = text.find("```", start)
        if end != -1:
            return text[start:end].strip()
    if "```" in text:
        start = text.find("```") + 3
        end = text.find("```", start)
        if end != -1:
            return text[start:end].strip()
    if "{" in text:
        start = text.find("{")
        return text[start:].strip()
    return text


def _parse_json_object(text: str) -> Optional[Dict[str, Any]]:
    """
    Parse the first complete JSON object from model output (handles markdown and trailing junk).
    """
    cleaned = _strip_json_fences(text.strip())
    start_idx = cleaned.find("{")
    if start_idx == -1:
        logger.error("No JSON object found in response")
        return None
    brace_count = 0
    for i, char in enumerate(cleaned[start_idx:], start_idx):
        if char == "{":
            brace_count += 1
        elif char == "}":
            brace_count -= 1
            if brace_count == 0:
                fragment = cleaned[start_idx : i + 1]
                try:
                    return json.loads(fragment)
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse LLM JSON object: {e}")
                    return None
    try:
        return json.loads(cleaned[start_idx:])
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse LLM response as JSON: {e}")
        return None


class LLMClient:
    """Chat completions via OpenRouter."""

    def __init__(
        self,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
    ):
        self.model_name = model_name or os.environ.get(
            "OPENROUTER_MODEL", DEFAULT_MODEL
        )
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY", "")
        self.base_url = (base_url or os.environ.get(
            "OPENROUTER_BASE_URL", DEFAULT_BASE_URL
        )).rstrip("/")

    def _headers(self) -> Dict[str, str]:
        h = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        referer = os.environ.get("OPENROUTER_HTTP_REFERER")
        if referer:
            h["HTTP-Referer"] = referer
        title = os.environ.get("OPENROUTER_APP_TITLE", "AI-Assisted Requirement Writing")
        h["X-Title"] = title
        return h

    def check_api_key_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    def generate_response(self, prompt: str, max_retries: int = 3) -> Optional[str]:
        """Call chat/completions; return assistant content (JSON-oriented text)."""
        if not self.check_api_key_configured():
            logger.error("OPENROUTER_API_KEY is not set")
            return None

        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a requirements engineering assistant. "
                        "Follow the user instructions exactly. "
                        "Respond with only valid JSON as specified, no extra commentary."
                    ),
                },
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.3,
            "top_p": 0.9,
            "max_tokens": 4096,
        }

        for attempt in range(max_retries):
            try:
                with httpx.Client(timeout=120.0) as client:
                    r = client.post(url, headers=self._headers(), json=payload)
                    r.raise_for_status()
                    data = r.json()
                choices = data.get("choices") or []
                if not choices:
                    logger.error("OpenRouter returned no choices")
                    return None
                message = choices[0].get("message") or {}
                raw_response = (message.get("content") or "").strip()
                if not raw_response:
                    return None
                return raw_response
            except httpx.HTTPStatusError as e:
                logger.error(
                    "Attempt %s failed: HTTP %s %s",
                    attempt + 1,
                    e.response.status_code,
                    e.response.text[:500] if e.response.text else "",
                )
                if attempt < max_retries - 1:
                    time.sleep(2**attempt)
                else:
                    return None
            except Exception as e:
                logger.error(f"Attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(2**attempt)
                else:
                    return None
        return None

    def generate_functional_requirements(
        self,
        entities: Dict,
        actions: List[str],
        keywords: List[str],
        context: str,
    ) -> List[Dict]:
        """Generate functional requirements based on extracted information."""
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

{PRIORITY_RULES_BLOCK}

Return only a JSON object with this structure (priorities must vary realistically):
{{
    "functional_requirements": [
        {{
            "id": "FR-001",
            "description": "The system shall allow users to create an account.",
            "priority": "High",
            "category": "User Account Management"
        }},
        {{
            "id": "FR-002",
            "description": "Users shall be able to browse products by category.",
            "priority": "Medium",
            "category": "Product Catalog"
        }},
        {{
            "id": "FR-003",
            "description": "The system shall offer optional product recommendations on the home page.",
            "priority": "Low",
            "category": "Product Catalog"
        }}
    ]
}}
"""

        response = self.generate_response(prompt)
        if not response:
            return []
        result = _parse_json_object(response)
        if not result:
            logger.error(f"Response was: {response[:2000]}")
            return []
        return result.get("functional_requirements", [])

    def generate_non_functional_requirements(
        self, keywords: List[str], context: str, entities: Dict
    ) -> List[Dict]:
        """Generate non-functional requirements (performance, security, usability, etc.)."""
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

{PRIORITY_RULES_BLOCK}

Return only a JSON object with this structure (priorities must vary realistically):
{{
    "non_functional_requirements": [
        {{
            "id": "NFR-001",
            "description": "The system shall encrypt sensitive data at rest and in transit.",
            "priority": "High",
            "category": "Security"
        }},
        {{
            "id": "NFR-002",
            "description": "The system shall respond to typical user actions within 2 seconds under normal load.",
            "priority": "Medium",
            "category": "Performance"
        }},
        {{
            "id": "NFR-003",
            "description": "The system shall support optional dark mode for the user interface.",
            "priority": "Low",
            "category": "Usability"
        }}
    ]
}}
"""

        response = self.generate_response(prompt)
        if not response:
            return []
        result = _parse_json_object(response)
        if not result:
            logger.error("Failed to parse LLM response as JSON")
            logger.error(f"Response was: {response[:2000]}")
            return []
        return result.get("non_functional_requirements", [])

    def get_system_status(self) -> Dict[str, Any]:
        """Status for CLI; compatible with app.py keys."""
        status: Dict[str, Any] = {
            "model_available": False,
            "model_name": self.model_name,
            "error": None,
        }
        if not self.check_api_key_configured():
            status["error"] = (
                "OPENROUTER_API_KEY is not set. Export it or add it to a .env file."
            )
            return status
        status["model_available"] = True
        return status


if __name__ == "__main__":
    client = LLMClient()
    print("=== LLM System Status ===")
    print(json.dumps(client.get_system_status(), indent=2))
    if client.get_system_status().get("model_available"):
        out = client.generate_response('Reply with JSON: {"ok": true}')
        print(f"\nTest: {out}")
