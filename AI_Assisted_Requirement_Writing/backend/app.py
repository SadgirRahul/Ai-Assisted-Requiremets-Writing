import PyPDF2
import os
import json
from preprocess import preprocess_pdf_text
from nlp_extractor import NLPExtractor
from llm_client import LLMClient
from requirements_generator import RequirementsGenerator


def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, "rb") as pdf_file:
        reader = PyPDF2.PdfReader(pdf_file)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text


def main():
    print("AI-Assisted Requirements Writing System")
    print("=" * 50)
    
    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_path = os.path.join(script_dir, "sample.pdf")
    
    # Check if file exists
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found at {pdf_path}")
        print("Please make sure sample.pdf is in the same directory as app.py")
        return
    
    # Step 1: Extract text from PDF
    print("\nStep 1: Extracting text from PDF...")
    pdf_text = extract_text_from_pdf(pdf_path)
    print(f"Extracted {len(pdf_text)} characters from PDF")
    
    # Step 2: Preprocess the text
    print("\nStep 2: Preprocessing text...")
    processed_segments = preprocess_pdf_text(pdf_text)
    print(f"Processed into {len(processed_segments)} segments")
    combined_text = " ".join(processed_segments)
    
    # Step 3: NLP Processing
    print("\nStep 3: Performing NLP analysis...")
    extractor = NLPExtractor()
    nlp_analysis = extractor.analyze_text(combined_text)
    
    print(f"Found {len(nlp_analysis['keywords'])} keywords")
    print(f"Found {len(nlp_analysis['actions'])} action verbs")
    print(f"Found {len(nlp_analysis['entities'])} entity types")
    print(f"Document intent: {nlp_analysis['intent']}")
    
    # Step 4: Check LLM setup
    print("\nStep 4: Setting up LLM...")
    llm_client = LLMClient()
    system_status = llm_client.get_system_status()
    
    if not system_status["model_available"]:
        print("LLM Error:")
        if system_status["error"]:
            print(f"   {system_status['error']}")
        print("\nPlease ensure:")
        print("1. Ollama is installed and running")
        print("2. Mistral model is available: 'ollama pull mistral'")
        return
    
    print("LLM system ready")
    
    # Step 5: Generate Requirements
    print("\nStep 5: Generating requirements...")
    generator = RequirementsGenerator(llm_client)
    requirements = generator.generate_all_requirements(nlp_analysis, combined_text)
    
    # Step 6: Format and Display Results
    print("\nStep 6: Formatting results...")
    output = generator.format_requirements_output(requirements)
    
    # Display summary
    print("\n" + "=" * 50)
    print("REQUIREMENTS GENERATION SUMMARY")
    print("=" * 50)
    
    summary = output["summary"]
    print(f"Total Requirements: {summary['total_requirements']}")
    print(f"Functional: {summary['functional_count']}")
    print(f"Non-Functional: {summary['non_functional_count']}")
    
    print("\nPriority Distribution:")
    for priority, count in summary["priorities"].items():
        print(f"  {priority}: {count}")
    
    print("\nCategory Distribution:")
    for category, count in summary["categories"].items():
        print(f"  {category}: {count}")
    
    # Display detailed requirements
    print("\n" + "=" * 50)
    print("GENERATED REQUIREMENTS")
    print("=" * 50)
    
    # Functional requirements
    func_reqs = output["requirements"]["functional"]
    if func_reqs:
        print("\nFUNCTIONAL REQUIREMENTS:")
        for req in func_reqs:
            print(f"\n[{req['id']}] {req['priority']} Priority - {req['category']}")
            print(f"    {req['description']}")
    
    # Non-functional requirements
    nfunc_reqs = output["requirements"]["non_functional"]
    if nfunc_reqs:
        print("\nNON-FUNCTIONAL REQUIREMENTS:")
        for req in nfunc_reqs:
            print(f"\n[{req['id']}] {req['priority']} Priority - {req['category']}")
            print(f"    {req['description']}")
    
    # Save to JSON file
    output_file = os.path.join(script_dir, "generated_requirements.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    
    print(f"\nResults saved to: {output_file}")
    print("\nRequirements generation completed successfully!")


if __name__ == "__main__":
    main()