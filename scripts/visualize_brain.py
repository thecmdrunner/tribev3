"""Visualize TRIBE v2 brain predictions on the cortical surface."""

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

from tribev2.demo_utils import TribeModel
from tribev2.plotting.cortical import PlotBrainNilearn
from pathlib import Path
import numpy as np

CACHE_FOLDER = Path("./cache")
VIDEO_PATH = "neude-ai-1.mp4"

# Load saved predictions
preds = np.load(CACHE_FOLDER / "neude-ai-1_preds.npy")
print(f"Loaded predictions: {preds.shape}")

plotter = PlotBrainNilearn(mesh="fsaverage5")

n_timesteps = min(15, preds.shape[0])

# Normalize predictions for consistent color scale
vmax = np.percentile(np.abs(preds[:n_timesteps]), 99)

# Create a grid of brain plots
n_cols = 5
n_rows = (n_timesteps + n_cols - 1) // n_cols

fig, axes = plt.subplots(
    n_rows, n_cols,
    figsize=(4 * n_cols, 4 * n_rows),
    subplot_kw={"projection": "3d"},
)
axes = axes.flatten()

for i in range(n_timesteps):
    print(f"Plotting timestep {i+1}/{n_timesteps}...")
    plotter.plot_surf(
        preds[i],
        axes=axes[i],
        views="left",
        cmap="hot",
        vmin=0,
        vmax=vmax,
    )
    axes[i].set_title(f"t={i}s", fontsize=10)

# Hide unused axes
for i in range(n_timesteps, len(axes)):
    axes[i].set_visible(False)

fig.suptitle("TRIBE v2 — Predicted Brain Activity (neude-ai-1.mp4)", fontsize=14, y=1.01)
fig.tight_layout()

output_path = CACHE_FOLDER / "neude-ai-1_brain.png"
fig.savefig(output_path, dpi=150, bbox_inches="tight")
print(f"Brain visualization saved to: {output_path}")
