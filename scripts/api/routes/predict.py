import uuid
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import FileResponse

from scripts.api.schemas import JobResponse, JobResult, JobStatus

router = APIRouter()

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


@router.post("/predict", response_model=JobResponse, status_code=202)
async def predict(video: UploadFile = File(...)):
    from scripts.api.main import worker

    if not video.filename.endswith((".mp4", ".mov", ".avi", ".mkv", ".webm")):
        raise HTTPException(status_code=400, detail="Unsupported video format")

    job_id = uuid.uuid4().hex[:12]
    video_path = UPLOAD_DIR / f"{job_id}_{video.filename}"

    content = await video.read()
    video_path.write_bytes(content)

    worker.submit(job_id, str(video_path))
    return JobResponse(job_id=job_id, status=JobStatus.queued)


@router.get("/jobs/{job_id}", response_model=JobResult)
def get_job(job_id: str):
    from scripts.api.main import worker

    result = worker.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResult(job_id=job_id, **result)


@router.get("/jobs/{job_id}/predictions")
def download_predictions(job_id: str):
    from scripts.api.main import worker

    result = worker.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if result["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job status: {result['status']}")

    path = Path(result["predictions_file"])
    return FileResponse(path, media_type="application/octet-stream", filename=f"{job_id}_preds.npy")


@router.get("/jobs/{job_id}/visualization")
def download_visualization(job_id: str):
    from scripts.api.main import worker

    result = worker.get_result(job_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Job not found")
    if result["status"] != "done":
        raise HTTPException(status_code=409, detail=f"Job status: {result['status']}")

    path = Path(result["visualization_file"])
    return FileResponse(path, media_type="image/png", filename=f"{job_id}_brain.png")
