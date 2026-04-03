from pydantic import BaseModel
from enum import Enum


class JobStatus(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"


class JobResponse(BaseModel):
    job_id: str
    status: JobStatus


class JobResult(BaseModel):
    job_id: str
    status: JobStatus
    message: str | None = None
    predictions_shape: list[int] | None = None
    predictions_file: str | None = None
    visualization_file: str | None = None
