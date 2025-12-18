from __future__ import annotations

"""
Neurobaseline backend API.

This small FastAPI app exposes three endpoints:
- GET /health : basic liveness check
- GET /results: returns the contents of backend/results.json (if present)
- POST /analyze: runs backend/run_pipeline.py (using the same Python interpreter)
  The pipeline is expected to write or update backend/results.json.

Design notes:
- We run the pipeline via subprocess using `sys.executable` to ensure we use
  the same Python environment as the API process.
- The API reads and returns the JSON file; it does not attempt to parse or
  validate the pipeline's internal behavior.
"""

import json
import subprocess
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Paths to important files in this directory
BASE_DIR = Path(__file__).resolve().parent
RESULTS_PATH = BASE_DIR / "results.json"  # the pipeline writes to this file
PIPELINE_SCRIPT = BASE_DIR / "run_pipeline.py"  # script that generates results.json

app = FastAPI(title="Neurobaseline API", version="0.1.0")

# Allow Next.js dev server to call the API
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
    # Returns the latest `results.json` from backend/
    # Note: this endpoint simply reads and returns the file contents as JSON
    # It does not validate or transform the data produced by the pipeline
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

    # Execute the pipeline script as a subprocess using the same Python interpreter
    # so we don't accidentally use a different virtualenv. We capture stdout/stderr
    # and return truncated outputs on failure to aid debugging
    proc = subprocess.run(
        [sys.executable, str(PIPELINE_SCRIPT)],
        cwd=str(BASE_DIR),
        capture_output=True,
        text=True,
    )

    if proc.returncode != 0:
        # Pipeline failed — return code and last part of stdout/stderr to help debug
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
