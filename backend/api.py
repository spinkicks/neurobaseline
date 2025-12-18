from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

BASE_DIR = Path(__file__).resolve().parent
RESULTS_PATH = BASE_DIR / "results.json"
PIPELINE_SCRIPT = BASE_DIR / "run_pipeline.py"

app = FastAPI(title="Neurobaseline API", version="0.1.0")

# Allow your Next.js dev server to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/results")
def get_results():
    # Returns the latest results.json from backend/
    if not RESULTS_PATH.exists():
        return {"error": "results.json not found in backend/", "path": str(RESULTS_PATH)}

    with RESULTS_PATH.open("r", encoding="utf-8") as f:
        return json.load(f)


@app.post("/analyze")
def analyze():
    """
    Optional: runs your pipeline script, which should generate/update backend/results.json.
    """
    if not PIPELINE_SCRIPT.exists():
        return {"error": "run_pipeline.py not found", "path": str(PIPELINE_SCRIPT)}

    # Run: python run_pipeline.py (using the same python that's running the API)
    proc = subprocess.run(
        [sys.executable, str(PIPELINE_SCRIPT)],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        return {
            "ok": False,
            "returncode": proc.returncode,
            "stdout": proc.stdout[-2000:],
            "stderr": proc.stderr[-2000:],
        }

    # Return the freshly updated results
    if not RESULTS_PATH.exists():
        return {"ok": False, "error": "Pipeline ran but results.json not created"}

    with RESULTS_PATH.open("r", encoding="utf-8") as f:
        return {"ok": True, "results": json.load(f)}
