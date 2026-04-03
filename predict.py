"""Cog predictor for TRIBE v2 — multimodal brain encoding model."""

import os
import tempfile
from pathlib import Path

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np
import requests
from cog import BasePredictor, Input, Path as CogPath


class Predictor(BasePredictor):
    def setup(self):
        """Load TRIBE v2 model and brain plotter once at container startup."""
        from tribev2.demo_utils import TribeModel
        from tribev2.plotting.cortical import PlotBrainNilearn

        cache_folder = Path("/tmp/tribe_cache")
        cache_folder.mkdir(exist_ok=True)

        print("[setup] Loading TribeModel from facebook/tribev2...")
        self.model = TribeModel.from_pretrained(
            "facebook/tribev2", cache_folder=cache_folder
        )
        # Force single-process data loading (avoids multiprocessing issues)
        self.model.data.num_workers = 0

        self.plotter = PlotBrainNilearn(mesh="fsaverage5")
        print("[setup] Model loaded. Ready for predictions.")

    def predict(
        self,
        video_url: str = Input(
            description="URL of the video file to process (mp4, mov, avi, mkv, webm)."
        ),
        max_timesteps: int = Input(
            description="Maximum number of timesteps to include in the brain visualization grid.",
            default=15,
            ge=1,
            le=60,
        ),
        visualization_view: str = Input(
            description="Brain surface view angle for the visualization.",
            default="left",
            choices=["left", "right", "dorsal", "ventral", "anterior", "posterior"],
        ),
        colormap: str = Input(
            description="Matplotlib colormap for brain activation rendering.",
            default="hot",
            choices=["hot", "cold_hot", "coolwarm", "viridis", "inferno", "plasma"],
        ),
        visualization_dpi: int = Input(
            description="DPI (resolution) of the output brain visualization image.",
            default=150,
            ge=72,
            le=300,
        ),
        return_raw_predictions: bool = Input(
            description="Also return the raw predictions as a .npy file alongside the visualization.",
            default=False,
        ),
    ) -> list[CogPath]:
        """Run TRIBE v2 inference on a video and return brain activation maps."""

        # Download video from URL
        video_path = self._download_video(video_url)

        try:
            # Run inference
            print(f"[predict] Building events dataframe from: {video_path.name}")
            df = self.model.get_events_dataframe(video_path=str(video_path))

            print("[predict] Running prediction...")
            preds, segments = self.model.predict(events=df)
            print(
                f"[predict] Predictions shape: {preds.shape} "
                f"(n_timesteps={preds.shape[0]}, n_vertices={preds.shape[1]})"
            )

            # Generate visualization
            viz_path = self._render_brain_visualization(
                preds=preds,
                video_name=video_path.stem,
                max_timesteps=max_timesteps,
                view=visualization_view,
                cmap=colormap,
                dpi=visualization_dpi,
            )

            outputs = [CogPath(viz_path)]

            # Optionally include raw predictions
            if return_raw_predictions:
                npy_path = Path(tempfile.mkdtemp()) / f"{video_path.stem}_predictions.npy"
                np.save(npy_path, preds)
                outputs.append(CogPath(npy_path))

            return outputs

        finally:
            # Clean up downloaded video
            if video_path.exists():
                video_path.unlink()

    def _download_video(self, url: str) -> Path:
        """Download a video from a URL to a temporary file."""
        print(f"[predict] Downloading video from: {url}")
        response = requests.get(url, stream=True, timeout=300)
        response.raise_for_status()

        # Infer extension from URL or content-type
        ext = Path(url.split("?")[0]).suffix or ".mp4"
        if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm"}:
            ext = ".mp4"

        tmp = Path(tempfile.mkdtemp()) / f"input{ext}"
        with open(tmp, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        size_mb = tmp.stat().st_size / (1024 * 1024)
        print(f"[predict] Downloaded {size_mb:.1f} MB to {tmp}")
        return tmp

    def _render_brain_visualization(
        self,
        preds: np.ndarray,
        video_name: str,
        max_timesteps: int,
        view: str,
        cmap: str,
        dpi: int,
    ) -> Path:
        """Render a grid of brain activation maps."""
        n_timesteps = min(max_timesteps, preds.shape[0])
        vmax = float(np.percentile(np.abs(preds[:n_timesteps]), 99))

        n_cols = min(5, n_timesteps)
        n_rows = (n_timesteps + n_cols - 1) // n_cols

        fig, axes = plt.subplots(
            n_rows,
            n_cols,
            figsize=(4 * n_cols, 4 * n_rows),
            subplot_kw={"projection": "3d"},
        )

        if n_rows == 1 and n_cols == 1:
            axes_flat = [axes]
        else:
            axes_flat = axes.flatten() if hasattr(axes, "flatten") else [axes]

        for i in range(n_timesteps):
            self.plotter.plot_surf(
                preds[i],
                axes=axes_flat[i],
                views=view,
                cmap=cmap,
                vmin=0,
                vmax=vmax,
            )
            axes_flat[i].set_title(f"t={i}s", fontsize=10)

        # Hide unused axes
        for i in range(n_timesteps, len(axes_flat)):
            axes_flat[i].set_visible(False)

        fig.suptitle(f"TRIBE v2 — {video_name}", fontsize=14, y=1.01)
        fig.tight_layout()

        out_path = Path(tempfile.mkdtemp()) / f"{video_name}_brain.png"
        fig.savefig(out_path, dpi=dpi, bbox_inches="tight")
        plt.close(fig)

        print(f"[predict] Visualization saved: {out_path}")
        return out_path
