"""
api.py
FastAPI application: upload PDF/DOCX, return generated requirements JSON; serve dashboard static files.
"""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

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
    async def generate(file: UploadFile = File(...)):
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
            output, err = run_generation_from_path(tmp_path)
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
