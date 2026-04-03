# TRIBE v2 — Knowledge Transfer

## What is TRIBE v2?

TRIBE v2 is a deep multimodal brain encoding model (by Meta/FAIR) that predicts **fMRI brain responses** to naturalistic stimuli — video, audio, and text. It combines three feature extractors:

- **LLaMA 3.2** — text features
- **V-JEPA2** — video features
- **Wav2Vec-BERT** — audio features

These are fed into a unified Transformer that maps multimodal representations onto the **fsaverage5** cortical surface (~20,484 vertices). Output shape is `(n_timesteps, 20484)` — one prediction per second of stimulus. Predictions are offset by 5 seconds to compensate for hemodynamic lag.

**Source repo:** https://github.com/thecmdrunner/tribev3 (fork of https://github.com/facebookresearch/tribev2)

---

## Environment Setup

### Requirements

- **Python 3.11+** (system had 3.10, so we bootstrapped via `uv`)
- **ffmpeg** (required by WhisperX for audio loading)
- **HuggingFace account** with access to LLaMA 3.2 (license acceptance required at https://huggingface.co/meta-llama/Llama-3.2-1B)

### Installation Steps

```bash
# 1. Install uv (fast Python/package manager, no root needed)
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.local/bin:$PATH"

# 2. Clone and create venv with Python 3.11
git clone https://github.com/thecmdrunner/tribev3.git
cd tribev3
uv venv --python 3.11 .venv

# 3. Install tribev2 + dependencies
uv pip install -e ".[plotting]"       # inference + brain visualization
# uv pip install -e ".[training]"     # if training needed (Lightning, W&B)

# 4. Install ffmpeg (static binary, no root)
curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz -o /tmp/ffmpeg.tar.xz
cd /tmp && tar xf ffmpeg.tar.xz
cp ffmpeg-*-amd64-static/ffmpeg ~/.local/bin/
cp ffmpeg-*-amd64-static/ffprobe ~/.local/bin/

# 5. HuggingFace login (needed for LLaMA 3.2 access)
.venv/bin/python -c "from huggingface_hub import login; login(token='hf_YOUR_TOKEN')"
```

**Note:** `huggingface-cli` binary doesn't exist in `huggingface_hub` v1.9.0. Use the Python `login()` function instead.

### Token Setup

1. Create a token at https://huggingface.co/settings/tokens (Read access)
2. Accept the LLaMA 3.2 license at https://huggingface.co/meta-llama/Llama-3.2-1B

---

## Running Inference

### Direct Script

```bash
cd /home/psl/tribev3
.venv/bin/python scripts/run_tribe.py
```

`scripts/run_tribe.py` loads the model, processes `neude-ai-1.mp4`, and saves predictions to `cache/neude-ai-1_preds.npy`.

### What Happens During Inference

1. **Audio extraction** — MoviePy extracts `.wav` from video
2. **Speech transcription** — WhisperX transcribes audio into word-level events with timestamps
3. **Spacy NLP** — Downloads `en_core_web_lg` (~400MB, first run only) for context building
4. **Feature extraction** — LLaMA 3.2 (text), Wav2Vec-BERT (audio), V-JEPA2 + DINOv2 (video)
5. **Prediction** — Transformer maps features to cortical surface

**Performance:** ~5 minutes on CPU for a 20-second video. Video encoding is the bottleneck (~6s per frame chunk).

**First run downloads:**
- Model checkpoint from HuggingFace (~1GB) → cached in `~/.cache/huggingface/`
- WhisperX model (via `uvx whisperx`)
- Spacy `en_core_web_lg` model (~400MB)
- LLaMA 3.2 weights

---

## Brain Visualization

### Backend Choice

Two plotting backends exist in `tribev2/plotting/`:

| Backend | Class | File | Requires |
|---------|-------|------|----------|
| **PyVista** (default) | `PlotBrainPyvista` | `cortical_pv.py` | Display or EGL/OSMesa |
| **Nilearn/Matplotlib** | `PlotBrainNilearn` | `cortical.py` | Nothing (headless-safe) |

`PlotBrain` in `__init__.py` aliases to PyVista. **On headless servers, use `PlotBrainNilearn` directly.**

### Headless Visualization Gotcha

`PlotBrainPyvista` crashes on headless servers (segfault — no X11/EGL/OSMesa). The `plot_timesteps()` method in `base.py` creates axes via `plt.subplot_mosaic()` without `projection='3d'`, which breaks `PlotBrainNilearn` too.

**Workaround:** Create your own 3D axes grid and call `plot_surf()` per-timestep. See `scripts/visualize_brain.py`.

```bash
.venv/bin/python scripts/visualize_brain.py
# Output: cache/neude-ai-1_brain.png
```

---

## REST API

### Architecture

```
scripts/api/
├── main.py              # FastAPI app + lifespan (starts/stops worker)
├── worker.py            # Separate process: loads model once, processes job queue
├── schemas.py           # Pydantic models (JobStatus, JobResponse, JobResult)
├── routes/
│   ├── health.py        # GET /health
│   └── predict.py       # POST /predict, GET /jobs/{id}, downloads
```

**Design:** FastAPI (async) handles HTTP. A **single worker process** (via `multiprocessing`) loads TribeModel at startup and pulls jobs from a `multiprocessing.Queue` one at a time. This keeps the API responsive during inference.

### Endpoints

| Method | Path | Description | Status Code |
|--------|------|-------------|-------------|
| `GET` | `/health` | Health check | 200 |
| `POST` | `/predict` | Upload video file → enqueues job | 202 |
| `GET` | `/jobs/{job_id}` | Poll job status | 200 / 404 |
| `GET` | `/jobs/{job_id}/predictions` | Download `.npy` predictions | 200 / 404 / 409 |
| `GET` | `/jobs/{job_id}/visualization` | Download brain PNG | 200 / 404 / 409 |

**Auto-generated docs:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- OpenAPI spec: `http://localhost:8000/openapi.json`

### Running the API

```bash
cd /home/psl/tribev3
.venv/bin/uvicorn scripts.api.main:app --host 0.0.0.0 --port 8000
```

### Usage Example

```bash
# Submit a video
curl -X POST http://localhost:8000/predict -F "video=@neude-ai-1.mp4"
# → {"job_id":"09efd4c9cfa4","status":"queued"}

# Poll status
curl http://localhost:8000/jobs/09efd4c9cfa4
# → {"job_id":"09efd4c9cfa4","status":"running","message":"Running inference...",...}

# Download results (after status: "done")
curl http://localhost:8000/jobs/09efd4c9cfa4/predictions -o preds.npy
curl http://localhost:8000/jobs/09efd4c9cfa4/visualization -o brain.png
```

### Error Handling

| Scenario | Response |
|----------|----------|
| Invalid file format (not `.mp4/.mov/.avi/.mkv/.webm`) | 400 |
| Job not found | 404 |
| Download requested while job still running/queued | 409 |

### Concurrency Model

- **FastAPI** runs async — handles many concurrent HTTP connections without blocking
- **Worker** is a separate `multiprocessing.Process` — GIL doesn't matter, inference runs in its own process
- **Queue** is `multiprocessing.Queue` — jobs processed one at a time (inference can't be parallelized on one machine without duplicating ~4GB of models)
- **All non-inference endpoints** (`/health`, `/jobs/{id}`, file downloads) stay responsive during inference

### Queue Options for Production

| Queue | Use Case |
|-------|----------|
| `multiprocessing.Queue` (current) | Dev / single server. In-memory, jobs lost on crash. |
| **Redis + `arq`** (recommended next step) | Async-native, job persistence, retries, result TTL. Fits FastAPI well. |
| Redis + `Celery` | Larger production. Monitoring (Flower), rate limiting, periodic tasks. |
| `dramatiq` + Redis/RabbitMQ | Simpler than Celery, middleware pipeline. |

---

## File Layout

```
tribev3/
├── tribev2/                    # Core library (installed as package)
│   ├── demo_utils.py           # TribeModel — main inference API
│   ├── model.py                # FmriEncoder Transformer
│   ├── eventstransforms.py     # WhisperX transcription, word extraction
│   ├── plotting/
│   │   ├── cortical.py         # PlotBrainNilearn (headless-safe)
│   │   ├── cortical_pv.py      # PlotBrainPyvista (needs display)
│   │   └── base.py             # BasePlotBrain, plot_timesteps
│   └── grids/                  # Training configs
├── scripts/
│   ├── run_tribe.py            # Standalone inference script
│   ├── visualize_brain.py      # Standalone visualization script
│   └── api/                    # REST API
│       ├── main.py
│       ├── worker.py
│       ├── schemas.py
│       └── routes/
│           ├── health.py
│           └── predict.py
├── cache/                      # Model cache + intermediate files
│   ├── neude-ai-1_preds.npy   # Saved predictions
│   └── neude-ai-1_brain.png   # Brain visualization
├── output/                     # API job outputs
├── uploads/                    # API uploaded videos
├── neude-ai-1.mp4             # Test video
├── pyproject.toml
└── tribe_demo.ipynb            # Original Colab demo notebook
```

---

## Known Issues / Gotchas

1. **Python 3.11+ required** — `pyproject.toml` enforces `requires-python = ">=3.11"`. Use `uv` to bootstrap if system Python is older.
2. **No `huggingface-cli` binary** in `huggingface_hub` v1.9.0 — use `from huggingface_hub import login; login()` instead.
3. **ffmpeg required** by WhisperX — not a Python dependency, must be installed separately.
4. **PyVista segfaults on headless servers** — use `PlotBrainNilearn` instead of `PlotBrain`.
5. **`plot_timesteps()` broken with nilearn backend** — axes aren't created with `projection='3d'`. Use manual `plt.subplots(subplot_kw={"projection": "3d"})` + `plot_surf()` loop instead.
6. **LLaMA 3.2 gated model** — must accept license on HuggingFace before first use.
7. **First run is slow** — downloads model checkpoint (~1GB), WhisperX, spacy model (~400MB), LLaMA weights. Subsequent runs use cache.
