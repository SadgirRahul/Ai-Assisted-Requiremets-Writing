# Requirements API (FastAPI)

## Setup

Install dependencies (from this folder or project venv):

```bash
pip install -r requirements.txt
```

Set `OPENROUTER_API_KEY` in `.env` (same as CLI).

## Run the server

From **`AI_Assisted_Requirement_Writing/backend`**:

```bash
uvicorn api:app --reload --host 127.0.0.1 --port 8000
```

- API docs: http://127.0.0.1:8000/docs  
- Health: `GET http://127.0.0.1:8000/api/health`  
- Generate: `POST http://127.0.0.1:8000/api/generate` — form field **`file`** (multipart), `.pdf` or `.docx` only.

Example (curl):

```bash
curl -X POST "http://127.0.0.1:8000/api/generate" -F "file=@sample.pdf"
```

CORS is enabled for common localhost dev ports (3000, 5173, 8080).
