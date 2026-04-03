"""Run TRIBE v2 inference on a video file."""

from tribev2.demo_utils import TribeModel
from pathlib import Path
import numpy as np

CACHE_FOLDER = Path("./cache")
VIDEO_PATH = "neude-ai-1.mp4"

print("Loading TRIBE v2 model...")
model = TribeModel.from_pretrained("facebook/tribev2", cache_folder=CACHE_FOLDER)

print(f"\nBuilding events dataframe from: {VIDEO_PATH}")
df = model.get_events_dataframe(video_path=VIDEO_PATH)
print(df.head(10)[["type", "start", "duration", "text", "context"]])

print("\nRunning prediction...")
preds, segments = model.predict(events=df)
print(f"\nPredictions shape: {preds.shape}  (n_timesteps, n_vertices)")

# Save predictions
output_path = CACHE_FOLDER / "neude-ai-1_preds.npy"
output_path.parent.mkdir(exist_ok=True)
np.save(output_path, preds)
print(f"Predictions saved to: {output_path}")
