"""
api.py
FastAPI application: upload PDF/DOCX, return generated requirements JSON; serve dashboard static files.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from llm_client import LLMClient
from pipeline import backend_dir, run_generation_from_path

# Max upload size (bytes) — enforced by reading chunks (Starlette default is 1MB; we allow larger)
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

if load_dotenv:
    load_dotenv(os.path.join(backend_dir(), ".env"))

_APP_DIR = Path(backend_dir())
_FRONTEND_DIR = _APP_DIR.parent / "frontend"


def _is_llm_error(msg: str) -> bool:
    m = msg.lower()
    return any(
        x in m
        for x in (
            "openrouter",
            "http",
            "timeout",
            "connection",
            "generation failed",
            "llm",
            "api",
            "401",
            "403",
            "429",
            "500",
            "502",
            "503",
        )
    )


def _default_developer_result(req_id: str) -> dict[str, Any]:
    return {
        "requirement_id": req_id,
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
            "reason": "Complexity not available due to invalid model JSON response.",
            "estimated_hours": 0,
        },
    }


def _strip_json_fences(raw_text: str) -> str:
    text = (raw_text or "").strip()
    if text.startswith("```json"):
        text = text[7:].strip()
    elif text.startswith("```"):
        text = text[3:].strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    return text


def _build_developer_prompt(
    domain: str,
    req_id: str,
    description: str,
    category: str,
    priority: str,
) -> str:
    return f"""You are a senior software engineer and technical architect.

Domain: {domain}
Requirement ID: {req_id}
Requirement: {description}
Category: {category}
Priority: {priority}

Analyze this requirement and respond ONLY with raw JSON (no markdown code blocks, no extra text) in this exact structure:
{{
  "tasks": [
    "Task description 1",
    "Task description 2",
    "Task description 3"
  ],
  "tech_stack": {{
    "frontend": ["technology1", "technology2"],
    "backend": ["technology1", "technology2"],
    "database": ["technology1"],
    "other": ["technology1"]
  }},
  "complexity": {{
    "level": "Low" or "Medium" or "High",
    "score": number between 1 and 10,
    "reason": "One sentence explaining why this complexity level",
    "estimated_hours": number
  }}
}}"""


def create_app() -> FastAPI:
    app = FastAPI(title="AI-Assisted Requirements API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:8000",
            "http://127.0.0.1:8000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    @app.post("/api/generate")
    async def generate(
        file: UploadFile = File(...),
        domain: str | None = Form(None),
    ):
        # Multipart form field `domain` (same role as Flask request.form.get("domain"))
        domain_value = (domain or "").strip() or None

        if not file.filename:
            raise HTTPException(status_code=400, detail="No file uploaded.")

        ext = Path(file.filename).suffix.lower()
        if ext not in (".pdf", ".docx"):
            raise HTTPException(
                status_code=400,
                detail="Unsupported file type. Upload a .pdf or .docx file.",
            )

        data = await file.read()
        if len(data) > MAX_UPLOAD_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
            )
        if len(data) == 0:
            raise HTTPException(status_code=400, detail="Empty file.")

        suffix = ext
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(data)
                tmp_path = tmp.name
        except OSError as e:
            raise HTTPException(
                status_code=500, detail=f"Could not store upload: {e}"
            ) from e

        try:
            output, err = run_generation_from_path(tmp_path, domain=domain_value)
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        if err:
            if _is_llm_error(err):
                raise HTTPException(status_code=503, detail=err)
            raise HTTPException(status_code=400, detail=err)

        return JSONResponse(content=output)

    @app.post("/analyze-developer")
    async def analyze_developer(payload: dict[str, Any]):
        requirements = payload.get("requirements")
        domain = payload.get("domain")

        if not isinstance(requirements, list):
            raise HTTPException(status_code=400, detail="`requirements` must be an array.")
        if not isinstance(domain, str) or not domain.strip():
            raise HTTPException(status_code=400, detail="`domain` must be a non-empty string.")

        llm_client = LLMClient()
        if not llm_client.check_api_key_configured():
            raise HTTPException(status_code=503, detail="OPENROUTER_API_KEY is not configured.")

        functional_requirements = [
            req
            for req in requirements
            if isinstance(req, dict) and str(req.get("type", "")).strip().lower() == "functional"
        ]

        results: list[dict[str, Any]] = []

        for req in functional_requirements:
            req_id = str(req.get("id") or "").strip() or "UNKNOWN"
            description = str(req.get("description") or "").strip()
            category = str(req.get("category") or "General").strip()
            priority = str(req.get("priority") or "Medium").strip()

            if not description:
                continue

            prompt = _build_developer_prompt(
                domain=domain.strip(),
                req_id=req_id,
                description=description,
                category=category,
                priority=priority,
            )

            raw_response = llm_client.generate_response(prompt, max_retries=2)
            cleaned_response = _strip_json_fences(raw_response or "")

            try:
                parsed = json.loads(cleaned_response)
                if not isinstance(parsed, dict):
                    raise json.JSONDecodeError("Expected object", cleaned_response, 0)
            except json.JSONDecodeError:
                print(f"[analyze-developer] Failed to parse JSON for requirement {req_id}")
                print(f"[analyze-developer] Raw response: {raw_response}")
                results.append(_default_developer_result(req_id))
                continue

            results.append(
                {
                    "requirement_id": req_id,
                    "tasks": parsed.get("tasks", []),
                    "tech_stack": parsed.get("tech_stack", _default_developer_result(req_id)["tech_stack"]),
                    "complexity": parsed.get("complexity", _default_developer_result(req_id)["complexity"]),
                }
            )

        return JSONResponse(content=results)

    if _FRONTEND_DIR.is_dir():
        app.mount(
            "/static",
            StaticFiles(directory=str(_FRONTEND_DIR)),
            name="static",
        )

        @app.get("/")
        async def index():
            index_path = _FRONTEND_DIR / "index.html"
            if not index_path.is_file():
                return JSONResponse(
                    content={"detail": "frontend/index.html not found"},
                    status_code=404,
                )
            return FileResponse(str(index_path))

    return app


app = create_app()
