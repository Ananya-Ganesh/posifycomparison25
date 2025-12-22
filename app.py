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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def _save_upload_to_temp(upload: UploadFile) -> str:
    suffix = os.path.splitext(upload.filename or "")[1] or ".pdf"
    print(f"[APP] Upload filename: {upload.filename}, suffix: {suffix}")
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as tmp:
        tmp.write(upload.file.read())
    return path


@app.post("/compare-pos")
async def compare_pos(
    po_a: UploadFile = File(...),
    po_b: UploadFile = File(...),
) -> Dict[str, Any]:
    """
    Accepts two PO files (PDF / image / DOCX / XLSX), runs the PO auditor,
    and returns the comparison result.
    """
    path_a = _save_upload_to_temp(po_a)
    path_b = _save_upload_to_temp(po_b)

    try:
        result = compare_for_frontend(path_a, path_b)
        return result
    finally:
        for p in (path_a, path_b):
            try:
                os.remove(p)
            except OSError:
                pass


@app.get("/api/health")
async def health_check():
    return {
        "message": (
            "PO comparison AI is running. "
            "Use POST /compare-pos with two PO files (PDF, image, DOCX, XLSX)."
        )
    }


# Mount the React frontend static files
# We mount 'assets' specifically to avoid conflicts, and then serve index.html for root
frontend_dist = os.path.join(os.path.dirname(__file__), "react-frontend", "dist")

# Ensure the path is absolute and correct
frontend_dist = os.path.abspath(frontend_dist)
print(f"Serving frontend from: {frontend_dist}")

if os.path.exists(frontend_dist):
    # Mount the assets folder explicitly
    assets_path = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
    
    # Serve other static files (like vite.svg, etc.) and fallback to index.html
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # If the file exists in dist (e.g., vite.svg), serve it
        possible_file = os.path.join(frontend_dist, full_path)
        if os.path.isfile(possible_file):
            return FileResponse(possible_file)
        
        # Check if the requested path is an API call that wasn't matched
        if full_path.startswith("api/") or full_path.startswith("compare-pos"):
             return {"detail": "Not Found", "path": full_path}

        # Otherwise, fallback to index.html for SPA routing
        return FileResponse(os.path.join(frontend_dist, "index.html"))
else:
    print(f"Warning: Frontend build directory not found at {frontend_dist}")
    print("Please run 'npm run build' in the react-frontend directory.")
    
    # Add a dummy root route so the user sees something instead of a 404
    @app.get("/")
    async def root_warning():
        return {
            "error": "Frontend not found",
            "message": f"Expected build directory at: {frontend_dist}",
            "instruction": "Please check the build logs and ensure 'npm run build' completed successfully."
        }


