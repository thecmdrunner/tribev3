"""Background worker that loads TribeModel once and processes jobs from a queue."""

import multiprocessing as mp
import traceback
from pathlib import Path

import numpy as np


def _worker_loop(job_queue: mp.Queue, result_store: dict, lock: mp.Lock):
    """Runs in a separate process. Loads model once, then processes jobs forever."""
    import matplotlib
    matplotlib.use("Agg")

    from tribev2.demo_utils import TribeModel
    from tribev2.plotting.cortical import PlotBrainNilearn
    import matplotlib.pyplot as plt

    cache_folder = Path("./cache")
    output_folder = Path("./output")
    output_folder.mkdir(exist_ok=True)

    print("[worker] Loading TribeModel...")
    model = TribeModel.from_pretrained("facebook/tribev2", cache_folder=cache_folder)
    # Force single-process data loading to avoid nested multiprocessing issues
    model.data.num_workers = 0
    plotter = PlotBrainNilearn(mesh="fsaverage5")
    print("[worker] Model loaded. Ready for jobs.")

    while True:
        job = job_queue.get()  # blocks until a job arrives
        job_id = job["job_id"]
        video_path = job["video_path"]

        with lock:
            result_store[job_id] = {"status": "running", "message": "Running inference..."}

        try:
            print(f"[worker] Processing job {job_id}: {video_path}")
            df = model.get_events_dataframe(video_path=video_path)
            preds, segments = model.predict(events=df)

            # Save predictions
            preds_file = output_folder / f"{job_id}_preds.npy"
            np.save(preds_file, preds)

            # Generate visualization
            viz_file = output_folder / f"{job_id}_brain.png"
            n_timesteps = min(15, preds.shape[0])
            vmax = np.percentile(np.abs(preds[:n_timesteps]), 99)

            n_cols = 5
            n_rows = (n_timesteps + n_cols - 1) // n_cols
            fig, axes = plt.subplots(
                n_rows, n_cols,
                figsize=(4 * n_cols, 4 * n_rows),
                subplot_kw={"projection": "3d"},
            )
            axes_flat = axes.flatten()
            for i in range(n_timesteps):
                plotter.plot_surf(preds[i], axes=axes_flat[i], views="left", cmap="hot", vmin=0, vmax=vmax)
                axes_flat[i].set_title(f"t={i}s", fontsize=10)
            for i in range(n_timesteps, len(axes_flat)):
                axes_flat[i].set_visible(False)
            fig.suptitle(f"TRIBE v2 — {Path(video_path).name}", fontsize=14, y=1.01)
            fig.tight_layout()
            fig.savefig(viz_file, dpi=150, bbox_inches="tight")
            plt.close(fig)

            with lock:
                result_store[job_id] = {
                    "status": "done",
                    "message": f"Predicted {preds.shape[0]} timesteps x {preds.shape[1]} vertices",
                    "predictions_shape": list(preds.shape),
                    "predictions_file": str(preds_file),
                    "visualization_file": str(viz_file),
                }
            print(f"[worker] Job {job_id} done.")

        except Exception as e:
            with lock:
                result_store[job_id] = {
                    "status": "failed",
                    "message": f"{type(e).__name__}: {e}\n{traceback.format_exc()}",
                }
            print(f"[worker] Job {job_id} failed: {e}")


class InferenceWorker:
    """Manages the background worker process."""

    def __init__(self):
        self._manager = mp.Manager()
        self._job_queue = mp.Queue()
        self._result_store = self._manager.dict()
        self._lock = mp.Lock()
        self._process: mp.Process | None = None

    def start(self):
        self._process = mp.Process(
            target=_worker_loop,
            args=(self._job_queue, self._result_store, self._lock),
            daemon=False,
        )
        self._process.start()
        print(f"[main] Worker process started (pid={self._process.pid})")

    def stop(self):
        if self._process and self._process.is_alive():
            self._process.terminate()
            self._process.join(timeout=5)

    def submit(self, job_id: str, video_path: str):
        with self._lock:
            self._result_store[job_id] = {"status": "queued", "message": "Waiting in queue..."}
        self._job_queue.put({"job_id": job_id, "video_path": video_path})

    def get_result(self, job_id: str) -> dict | None:
        return dict(self._result_store.get(job_id, {})) or None
