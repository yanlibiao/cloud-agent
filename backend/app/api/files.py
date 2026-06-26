"""File browsing endpoints."""
import os
import shutil
import tempfile
from pathlib import Path
from zipfile import ZipFile

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse

from app.sandbox.manager import sandbox_manager

router = APIRouter()


def _get_workspace(session_id: str) -> str:
    """Get workspace path for a session."""
    sandbox = sandbox_manager.get_session(session_id)
    if not sandbox:
        raise HTTPException(status_code=404, detail="Session not found")
    return sandbox.workspace_path


@router.get("/{session_id}/tree")
async def get_file_tree(session_id: str, path: str = Query(default=".", description="Subdirectory path")):
    """Get directory tree listing."""
    workspace = os.path.abspath(_get_workspace(session_id))
    target = os.path.abspath(os.path.join(workspace, path))

    if not target.startswith(workspace):
        raise HTTPException(status_code=403, detail=f"Path outside workspace ({target} vs {workspace})")

    if not os.path.exists(target):
        return {"path": path, "entries": []}

    entries = []
    try:
        for name in sorted(os.listdir(target)):
            full = os.path.join(target, name)
            try:
                stat = os.stat(full)
                entries.append({
                    "name": name,
                    "type": "directory" if os.path.isdir(full) else "file",
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                })
            except OSError:
                continue
    except PermissionError:
        raise HTTPException(status_code=403, detail="Permission denied")

    return {"path": path, "entries": entries}


@router.get("/{session_id}/read")
async def read_file(session_id: str, path: str = Query(description="File path relative to workspace")):
    """Read file contents."""
    workspace = os.path.abspath(_get_workspace(session_id))
    target = os.path.abspath(os.path.join(workspace, path))

    if not target.startswith(workspace):
        raise HTTPException(status_code=403, detail="Path outside workspace")

    if not os.path.isfile(target):
        raise HTTPException(status_code=404, detail="File not found")

    try:
        with open(target, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return {"path": path, "content": content, "size": len(content)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/download")
async def download_file(session_id: str, path: str = Query(description="File path relative to workspace")):
    """Download a single file from the workspace."""
    workspace = os.path.abspath(_get_workspace(session_id))
    target = os.path.abspath(os.path.join(workspace, path))

    if not target.startswith(workspace):
        raise HTTPException(status_code=403, detail="Path outside workspace")

    if not os.path.isfile(target):
        raise HTTPException(status_code=404, detail="File not found")

    filename = os.path.basename(target)
    return FileResponse(target, filename=filename, media_type="application/octet-stream")


@router.get("/{session_id}/download-all")
async def download_all(session_id: str, subdir: str = Query(default="", description="Subdirectory path relative to workspace")):
    """Download the entire workspace (or a subdirectory) as a zip file."""
    workspace = os.path.abspath(_get_workspace(session_id))
    base_path = os.path.abspath(os.path.join(workspace, subdir)) if subdir else workspace

    if not base_path.startswith(workspace):
        raise HTTPException(status_code=403, detail="Path outside workspace")

    if not os.path.isdir(base_path) or not os.listdir(base_path):
        raise HTTPException(status_code=404, detail="Directory is empty")

    # Create zip in temp dir
    zip_path = os.path.join(tempfile.gettempdir(), f"workspace_{session_id}.zip")
    with ZipFile(zip_path, "w") as zf:
        for root, dirs, files in os.walk(base_path):
            for file in files:
                full_path = os.path.join(root, file)
                arcname = os.path.relpath(full_path, base_path)
                zf.write(full_path, arcname)

    label = subdir.replace("/", "_") if subdir else "workspace"
    return FileResponse(
        zip_path,
        filename=f"{label}_{session_id}.zip",
        media_type="application/zip",
    )
