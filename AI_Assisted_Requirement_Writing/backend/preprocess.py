"""
preprocess.py
Module for preprocessing extracted text from PDF files for requirement generation.
"""
import re
from typing import List

def clean_text(text: str) -> str:
    """Remove extra whitespace, line breaks, and non-informative characters."""
    # Remove non-printable characters
    text = re.sub(r'[^\x20-\x7E\n\r]', '', text)
    # Replace multiple spaces/newlines with single
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def segment_text(text: str) -> List[str]:
    """Segment text into sentences using simple punctuation rules."""
    # Split on period, exclamation, or question mark followed by space or end of string
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def preprocess_pdf_text(raw_text: str) -> List[str]:
    """Full preprocessing pipeline: clean and segment text."""
    cleaned = clean_text(raw_text)
    segments = segment_text(cleaned)
    return segments
