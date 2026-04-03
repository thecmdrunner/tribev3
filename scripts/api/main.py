"""TRIBE v2 REST API — FastAPI + background inference worker."""

import atexit
from contextlib import asynccontextmanager

from fastapi import FastAPI

from scripts.api.worker import InferenceWorker
from scripts.api.routes import health, predict

worker = InferenceWorker()
atexit.register(worker.stop)


@asynccontextmanager
async def lifespan(app: FastAPI):
    worker.start()
    yield
    worker.stop()


app = FastAPI(
    title="TRIBE v2 API",
    description="Predict fMRI brain responses to video using TRIBE v2",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(predict.router)
