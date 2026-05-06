import argparse
import io
import json
import os
import requests
import sys
import threading
from contextlib import redirect_stdout

from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

from llm_client import LLMClient

# Default document shipped with the repo (same folder as app.py).
DEFAULT_INPUT_FILE = "sample.pdf"

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://localhost:3001"])


def _backend_dir():
    return os.path.dirname(os.path.abspath(__file__))


def _load_env():
    if load_dotenv:
        load_dotenv(os.path.join(_backend_dir(), ".env"))


def _default_developer_payload() -> dict:
    return {
        "tasks": [],
        "tech_stack": {
            "frontend": [],
            "backend": [],
            "database": [],
            "other": [],
        },
        "complexity": {
            "level": "Medium",
            "score": 5,
            "reason": "Could not analyze",
            "estimated_hours": 0,
        },
    }


@app.route('/analyze-developer', methods=['POST'])
def analyze_developer():
    api_key = os.getenv("OPENROUTER_API_KEY")
    print("API KEY FOUND:", "YES" if api_key else "NO")
    print("KEY STARTS WITH:", api_key[:15] if api_key else "NOTHING")

    data = request.get_json() or {}
    requirements = data.get("requirements", [])
    domain = data.get("domain", "General")

    if not isinstance(requirements, list):
        return jsonify({"error": "`requirements` must be an array"}), 400

    import requests, os, re, json

    api_key = os.getenv("OPENROUTER_API_KEY")
    model_name = os.getenv("OPENROUTER_MODEL", "qwen/qwen3-8b")

    results = []

    for req in requirements:
        if not isinstance(req, dict):
            continue
        if str(req.get("type", "")).lower() != "functional":
            continue

        prompt = f"""You are a senior software engineer.
Requirement: {req['description']}
Domain: {domain}

Respond with raw JSON only. No markdown. No code blocks.
Start directly with open curly brace.

{{
  "tasks": [
    "Task 1",
    "Task 2", 
    "Task 3",
    "Task 4",
    "Task 5"
  ],
  "tech_stack": {{
    "frontend": ["React", "Tailwind CSS"],
    "backend": ["Node.js", "Express"],
    "database": ["MongoDB"],
    "other": ["JWT"]
  }},
  "complexity": {{
    "level": "Medium",
    "score": 6,
    "reason": "Reason here",
    "estimated_hours": 12
  }}
}}"""

        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:3000",
                "X-Title": "AI Requirements Tool"
            },
            json={
                "model": model_name,
                "messages": [{"role": "user", "content": prompt}]
            },
            timeout=30
        )

        print("STATUS CODE:", response.status_code)
        
        if response.status_code != 200:
            print("ERROR:", response.text)
            continue

        raw = response.json()["choices"][0]["message"]["content"]
        print("RAW RESPONSE:", raw[:300])

        raw = raw.strip()
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'^```\s*', '', raw)
        raw = re.sub(r'```$', '', raw)
        raw = raw.strip()

        try:
            parsed = json.loads(raw)
        except Exception as e:
            print("PARSE FAILED:", e)
            print("FULL RAW:", raw)
            parsed = {
                "tasks": [],
                "tech_stack": {
                    "frontend": [], "backend": [],
                    "database": [], "other": []
                },
                "complexity": {
                    "level": "Medium", "score": 5,
                    "reason": "Parse failed", "estimated_hours": 0
                }
            }

        results.append({
            "id": req["id"],
            "description": req["description"],
            "tasks": parsed.get("tasks", []),
            "tech_stack": parsed.get("tech_stack", {}),
            "complexity": parsed.get("complexity", {})
        })

    return jsonify(results)


def pick_input_path_interactive() -> str | None:
    """Native OS dialog; returns absolute path or None if cancelled."""
    import tkinter as tk
    from tkinter import filedialog

    root = tk.Tk()
    root.withdraw()
    root.attributes("-topmost", True)
    path = filedialog.askopenfilename(
        title="Select PDF or Word document",
        filetypes=[
            ("PDF and Word", "*.pdf *.docx"),
            ("PDF files", "*.pdf"),
            ("Word documents", "*.docx"),
            ("All files", "*.*"),
        ],
    )
    root.destroy()
    if not path:
        return None
    return os.path.abspath(path)


def run_pipeline(input_path: str) -> int:
    """
    Run full extract → preprocess → NLP → LLM → JSON.
    Returns 0 on success, 1 on failure (prints human-readable errors).
    """
    script_dir = _backend_dir()
    input_path = os.path.abspath(input_path)

    from document_extract import extract_text
    from preprocess import preprocess_pdf_text
    from nlp_extractor import NLPExtractor
    from requirements_generator import RequirementsGenerator

    print("AI-Assisted Requirements Writing System")
    print("=" * 50)
    print(f"Input document: {input_path}")

    if not os.path.isfile(input_path):
        print(f"Error: Input file not found: {input_path}")
        print("Choose a .pdf or .docx file.")
        return 1

    print("\nStep 0: Checking OpenRouter configuration...")
    llm_client = LLMClient()
    system_status = llm_client.get_system_status()
    if not system_status["model_available"]:
        print("LLM Error:")
        if system_status["error"]:
            print(f"   {system_status['error']}")
        print("\nPlease ensure:")
        print("1. Set environment variable OPENROUTER_API_KEY (or add it to backend/.env)")
        print("2. Optional: OPENROUTER_MODEL (default: qwen/qwen3-8b)")
        print("3. Optional: OPENROUTER_BASE_URL (default: https://openrouter.ai/api/v1)")
        return 1
    print(f"OpenRouter ready (model: {system_status['model_name']})")

    print("\nStep 1: Extracting text from document...")
    try:
        raw_text = extract_text(input_path)
    except (ValueError, FileNotFoundError) as e:
        print(f"Error: {e}")
        return 1

    if not raw_text or not raw_text.strip():
        print(
            "Error: No text could be extracted from the document "
            "(file may be empty, scanned images only, or unsupported content)."
        )
        return 1

    print(f"Extracted {len(raw_text)} characters from {os.path.basename(input_path)}")

    print("\nStep 2: Preprocessing text...")
    processed_segments = preprocess_pdf_text(raw_text)
    print(f"Processed into {len(processed_segments)} segments")
    combined_text = " ".join(processed_segments)

    print("\nStep 3: Performing NLP analysis...")
    extractor = NLPExtractor()
    nlp_analysis = extractor.analyze_text(combined_text)

    print(f"Found {len(nlp_analysis['keywords'])} keywords")
    print(f"Found {len(nlp_analysis['actions'])} action verbs")
    print(f"Found {len(nlp_analysis['entities'])} entity types")
    print(f"Document intent: {nlp_analysis['intent']}")

    print("\nStep 4: Generating requirements (OpenRouter)...")
    generator = RequirementsGenerator(llm_client)
    requirements = generator.generate_all_requirements(nlp_analysis, combined_text)

    print("\nStep 5: Formatting results...")
    output = generator.format_requirements_output(requirements)

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

    print("\n" + "=" * 50)
    print("GENERATED REQUIREMENTS")
    print("=" * 50)

    func_reqs = output["requirements"]["functional"]
    if func_reqs:
        print("\nFUNCTIONAL REQUIREMENTS:")
        for req in func_reqs:
            print(f"\n[{req['id']}] {req['priority']} Priority - {req['category']}")
            print(f"    {req['description']}")

    nfunc_reqs = output["requirements"]["non_functional"]
    if nfunc_reqs:
        print("\nNON-FUNCTIONAL REQUIREMENTS:")
        for req in nfunc_reqs:
            print(f"\n[{req['id']}] {req['priority']} Priority - {req['category']}")
            print(f"    {req['description']}")

    output_file = os.path.join(script_dir, "generated_requirements.json")
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\nResults saved to: {output_file}")
    print("\nRequirements generation completed successfully!")
    return 0


def run_gui():
    """Small window: Browse for PDF/Word, then generate (log in window)."""
    import tkinter as tk
    from tkinter import filedialog, messagebox, scrolledtext

    _load_env()

    script_dir = _backend_dir()
    root = tk.Tk()
    root.title("AI-Assisted Requirements Writing")
    root.minsize(560, 420)

    path_var = tk.StringVar()
    selected: list[str | None] = [None]

    frm = tk.Frame(root, padx=12, pady=10)
    frm.pack(fill=tk.BOTH, expand=True)

    tk.Label(frm, text="Document (PDF or Word)", font=("Segoe UI", 10, "bold")).pack(
        anchor=tk.W
    )
    path_label = tk.Label(
        frm,
        textvariable=path_var,
        wraplength=520,
        justify=tk.LEFT,
        fg="#333",
    )
    path_label.pack(fill=tk.X, pady=(4, 8))

    btn_row = tk.Frame(frm)
    btn_row.pack(fill=tk.X, pady=(0, 8))

    def browse():
        p = filedialog.askopenfilename(
            title="Select PDF or Word document",
            initialdir=os.path.expanduser("~\\Documents"),
            filetypes=[
                ("PDF and Word", "*.pdf *.docx"),
                ("PDF files", "*.pdf"),
                ("Word documents", "*.docx"),
                ("All files", "*.*"),
            ],
        )
        if p:
            selected[0] = os.path.abspath(p)
            path_var.set(selected[0])

    browse_btn = tk.Button(
        btn_row,
        text="Choose PDF or Word file…",
        command=browse,
        padx=12,
        pady=6,
    )
    browse_btn.pack(side=tk.LEFT)

    log = scrolledtext.ScrolledText(frm, height=16, wrap=tk.WORD, font=("Consolas", 9))
    log.pack(fill=tk.BOTH, expand=True, pady=(8, 0))

    gen_btn = tk.Button(frm, text="Generate requirements", padx=12, pady=8)
    gen_btn.pack(pady=(10, 0))

    def set_busy(busy: bool):
        state = tk.DISABLED if busy else tk.NORMAL
        browse_btn.config(state=state)
        gen_btn.config(state=state)

    def append_log(text: str):
        log.insert(tk.END, text)
        log.see(tk.END)
        log.update_idletasks()

    def on_done(buf: str, code: int):
        set_busy(False)
        if buf:
            append_log(buf)
        out_json = os.path.join(script_dir, "generated_requirements.json")
        if code == 0:
            messagebox.showinfo(
                "Done",
                f"Requirements saved to:\n{out_json}",
            )
        else:
            messagebox.showerror(
                "Run failed",
                "Something went wrong. See the log above for details.",
            )

    def generate_clicked():
        p = selected[0]
        if not p or not os.path.isfile(p):
            messagebox.showwarning(
                "No file",
                "Click “Choose PDF or Word file…” and select a document first.",
            )
            return
        log.delete("1.0", tk.END)
        set_busy(True)

        def worker():
            buf = io.StringIO()
            try:
                with redirect_stdout(buf):
                    code = run_pipeline(p)
            except Exception as e:
                buf.write(f"\nError: {e}\n")
                code = 1
            text = buf.getvalue()
            root.after(0, lambda: on_done(text, code))

        threading.Thread(target=worker, daemon=True).start()

    gen_btn.config(command=generate_clicked)

    tk.Label(
        frm,
        text=f"Output file: {os.path.join(script_dir, 'generated_requirements.json')}",
        font=("Segoe UI", 8),
        fg="#666",
    ).pack(anchor=tk.W, pady=(6, 0))

    root.mainloop()


def main():
    _load_env()
    script_dir = _backend_dir()
    default_input = os.path.join(script_dir, DEFAULT_INPUT_FILE)

    epilog = f"""
Commands — how to choose the input file:
  Default (repo sample)
      python app.py
      Uses "{DEFAULT_INPUT_FILE}" in this folder: {script_dir}

  Specific path
      python app.py --input "C:\\path\\to\\document.pdf"
      python app.py -i "C:\\path\\to\\spec.docx"

  File picker (dialog), then run in this terminal
      python app.py --pick
      python app.py -p

  Window with Browse + Generate buttons
      python app.py --gui
      python app.py -g
"""

    parser = argparse.ArgumentParser(
        description="AI-Assisted Requirements Writing: extract text from PDF or Word, "
        "then generate requirements via OpenRouter.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=epilog,
    )
    parser.add_argument(
        "--input",
        "-i",
        dest="input_path",
        default=None,
        metavar="PATH",
        help=f"Path to .pdf or .docx (default if omitted: {DEFAULT_INPUT_FILE} next to app.py)",
    )
    parser.add_argument(
        "--pick",
        "-p",
        action="store_true",
        help="Open a file picker, then run in this terminal",
    )
    parser.add_argument(
        "--gui",
        "-g",
        action="store_true",
        help="Open a window with Browse and Generate buttons",
    )
    args = parser.parse_args()

    if args.gui:
        run_gui()
        return

    if args.pick:
        picked = pick_input_path_interactive()
        if not picked:
            print("No file selected.")
            sys.exit(0)
        input_path = picked
    else:
        using_default = args.input_path is None
        input_path = os.path.abspath(args.input_path or default_input)
        if using_default and not os.path.isfile(input_path):
            print(
                f"Error: Default input not found: {input_path}\n"
                f"Add {DEFAULT_INPUT_FILE} next to app.py, or use:\n"
                "  --input PATH   for a specific file\n"
                "  --pick / -p    for a file picker\n"
                "  --gui / -g     for a window with Browse\n"
                "Run: python app.py --help"
            )
            sys.exit(1)

    code = run_pipeline(input_path)
    sys.exit(code)


if __name__ == "__main__":
    main()
