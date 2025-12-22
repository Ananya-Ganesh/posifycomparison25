from __future__ import annotations

import os
import tempfile
from typing import Dict, Any

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from po_frontend_adapter import compare_for_frontend

app = FastAPI(title="PO Comparison AI Tool")

# -------------------- CORS --------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- HELPERS --------------------
def _save_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".pdf"
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as tmp:
        tmp.write(upload.file.read())
    return path

# -------------------- API ROUTES --------------------
@app.post("/compare-pos")
async def compare_pos(
    po_a: UploadFile = File(...),
    po_b: UploadFile = File(...),
) -> Dict[str, Any]:
    path_a = _save_upload_to_temp(po_a)
    path_b = _save_upload_to_temp(po_b)

    try:
        return compare_for_frontend(path_a, path_b)
    finally:
        for p in (path_a, path_b):
            try:
                os.remove(p)
            except OSError:
                pass


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}

# -------------------- FRONTEND --------------------
FRONTEND_DIR = os.path.abspath("frontend_build")
print("Serving frontend from:", FRONTEND_DIR)

if os.path.exists(FRONTEND_DIR):

    # Serve static assets (JS, CSS)
    app.mount(
        "/assets",
        StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")),
        name="assets",
    )

    # Serve index.html for SPA routes
    @app.get("/{path:path}")
    async def serve_react_app(path: str):
        file_path = os.path.join(FRONTEND_DIR, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

else:
    @app.get("/")
    async def frontend_missing():
        return {
            "error": "Frontend not built",
            "expected": FRONTEND_DIR,
            "hint": "Check nixpacks.toml build steps"
        }
