# TRIBE v2 — Frontend PRD

## Overview

A minimal web dashboard for running TRIBE v2 brain encoding inference. Users upload a video, watch it process, and view the predicted fMRI brain activation map — no auth, no accounts.

## User Flow

```
Landing Page → Upload Video → Processing (live status) → View Results
```

### Step-by-step

1. **Land on dashboard** — Clean hero with "Upload a video to predict brain activity" and a prominent upload zone.
2. **Upload video** — Drag-and-drop or click-to-browse. Accepted: `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm`. Max 500MB.
   - Video uploads to Cloudflare R2 (via Next.js API route using S3 SDK).
   - Simultaneously submitted to Python inference API.
3. **Processing** — Job card appears below upload zone showing:
   - Video filename + file size
   - Status badge: `Uploading → Queued → Running → Done` (or `Failed`)
   - Elapsed time counter while running
   - Polls every 2 seconds.
4. **View results** — When done, the job card expands to show:
   - Brain activation heatmap (PNG rendered inline)
   - Download buttons: brain visualization (.png), raw predictions (.npy)
5. **Submit another** — Upload zone stays active. Multiple past jobs stack below, most recent first.

## Architecture

```
┌─────────────┐       ┌──────────────────┐       ┌──────────────────┐
│   Browser    │──────▶│  Next.js :3000    │──────▶│  Python API :8000│
│  (React UI)  │       │  API Routes:      │       │  FastAPI + Worker │
│              │       │  /api/upload → R2  │       │  /predict         │
│              │       │  /api/jobs/[id]    │       │  /jobs/{id}       │
│              │       │  /api/jobs/[id]/*  │       │  /jobs/{id}/*     │
└─────────────┘       └──────────────────┘       └──────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │ Cloudflare R2 │
                       │ (video store) │
                       └──────────────┘
```

- **Next.js** (port 3000): Serves UI + proxies all API calls to Python backend. Handles R2 uploads via `@aws-sdk/client-s3`.
- **Python API** (port 8000): Existing FastAPI app. Receives video, runs inference, returns predictions + visualization.
- **No database**: Job state lives in Python API memory. Videos persist in R2. Acceptable for MVP — jobs lost on restart.

## UX Principles

- **Zero friction**: No auth, no setup, no config. Land → upload → see results.
- **Always show progress**: Upload percentage, job status polling, elapsed time.
- **Inline results**: Brain map renders directly in the page — no separate downloads page.
- **Error recovery**: Clear error messages with "Try again" affordance.
- **Responsive**: Works on desktop and tablet. Mobile is stretch goal.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Frontend framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS 4 |
| Language | TypeScript |
| Object storage | Cloudflare R2 (S3-compatible) |
| S3 SDK | `@aws-sdk/client-s3` |
| Backend API | Existing Python FastAPI |
| Inference | TRIBE v2 (existing) |

## Environment Variables (Next.js)

```
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=tribe-uploads
R2_PUBLIC_URL=          # optional, for public access to uploads
PYTHON_API_URL=http://localhost:8000
```

## Non-Goals (MVP)

- User authentication / accounts
- Job history persistence (database)
- Multiple concurrent inference workers
- Video preview/playback in browser
- Real-time WebSocket updates (polling is fine)
