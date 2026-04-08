"""
pipeline.py
Shared requirement-generation logic for CLI, GUI, and HTTP API.
"""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional, Tuple

from document_extract import extract_text
from preprocess import preprocess_pdf_text
from nlp_extractor import NLPExtractor
from llm_client import LLMClient
from requirements_generator import RequirementsGenerator


def backend_dir() -> str:
    return os.path.dirname(os.path.abspath(__file__))


def run_generation_from_path(
    input_path: str, domain: Optional[str] = None
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """
    Run extract → preprocess → NLP → LLM → formatted output dict.

    Returns:
        (output_dict, None) on success — same shape as generated_requirements.json /
        format_requirements_output.
        (None, error_message) on failure. No sys.exit.
    """
    input_path = os.path.abspath(input_path)
    if not os.path.isfile(input_path):
        return None, f"Input file not found: {input_path}"

    ext = os.path.splitext(input_path)[1].lower()
    if ext not in (".pdf", ".docx"):
        return None, f"Unsupported file type '{ext}'. Use .pdf or .docx."

    try:
        llm_client = LLMClient()
        status = llm_client.get_system_status()
        if not status["model_available"]:
            return None, status.get("error") or "LLM is not configured (check OPENROUTER_API_KEY)."

        try:
            raw_text = extract_text(input_path)
        except (ValueError, FileNotFoundError) as e:
            return None, str(e)

        if not raw_text or not raw_text.strip():
            return None, (
                "No text could be extracted from the document "
                "(empty file, scanned images only, or unsupported content)."
            )

        processed_segments = preprocess_pdf_text(raw_text)
        combined_text = " ".join(processed_segments)

        extractor = NLPExtractor()
        nlp_analysis = extractor.analyze_text(combined_text)

        generator = RequirementsGenerator(llm_client)
        requirements = generator.generate_all_requirements(
            nlp_analysis, combined_text, domain=domain
        )
        output = generator.format_requirements_output(requirements)
        return output, None
    except Exception as e:
        return None, f"Generation failed: {e}"


def save_output_json(output: Dict[str, Any], path: str) -> None:
    """Write formatted output to a JSON file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)


def format_output_for_terminal(output: Dict[str, Any]) -> str:
    """Build the same text report previously printed by app.run_pipeline."""
    lines: list[str] = []
    summary = output["summary"]
    lines.append("\n" + "=" * 50)
    lines.append("REQUIREMENTS GENERATION SUMMARY")
    lines.append("=" * 50)
    lines.append(f"Total Requirements: {summary['total_requirements']}")
    lines.append(f"Functional: {summary['functional_count']}")
    lines.append(f"Non-Functional: {summary['non_functional_count']}")
    lines.append("\nPriority Distribution:")
    for priority, count in summary["priorities"].items():
        lines.append(f"  {priority}: {count}")
    lines.append("\nCategory Distribution:")
    for category, count in summary["categories"].items():
        lines.append(f"  {category}: {count}")
    lines.append("\n" + "=" * 50)
    lines.append("GENERATED REQUIREMENTS")
    lines.append("=" * 50)

    func_reqs = output["requirements"]["functional"]
    if func_reqs:
        lines.append("\nFUNCTIONAL REQUIREMENTS:")
        for req in func_reqs:
            lines.append(
                f"\n[{req['id']}] {req['priority']} Priority - {req['category']}"
            )
            lines.append(f"    {req['description']}")

    nfunc_reqs = output["requirements"]["non_functional"]
    if nfunc_reqs:
        lines.append("\nNON-FUNCTIONAL REQUIREMENTS:")
        for req in nfunc_reqs:
            lines.append(
                f"\n[{req['id']}] {req['priority']} Priority - {req['category']}"
            )
            lines.append(f"    {req['description']}")

    lines.append("")
    return "\n".join(lines)
