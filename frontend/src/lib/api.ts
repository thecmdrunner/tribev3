/**
 * Client for the Python inference API (minimal compute backend).
 * Next.js owns job lifecycle; this just submits work and fetches results.
 */

const API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";

/** Submit a video for inference. Returns the Python-side job ID. */
export async function submitInference(
  videoBuffer: ArrayBuffer,
  filename: string
): Promise<{ job_id: string; status: string }> {
  const formData = new FormData();
  const blob = new Blob([videoBuffer], { type: "video/mp4" });
  formData.append("video", blob, filename);

  const res = await fetch(`${API_URL}/predict`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Inference API error (${res.status}): ${text}`);
  }
  return res.json();
}

/** Poll inference status from Python API. */
export async function getInferenceStatus(
  inferenceId: string
): Promise<{
  job_id: string;
  status: string;
  message?: string;
  error?: string;
}> {
  const res = await fetch(`${API_URL}/jobs/${inferenceId}`);
  if (!res.ok) {
    throw new Error(`Inference job not found: ${inferenceId}`);
  }
  return res.json();
}

/** Download predictions (.npy) from Python API. */
export async function getInferencePredictions(
  inferenceId: string
): Promise<ArrayBuffer> {
  const res = await fetch(`${API_URL}/jobs/${inferenceId}/predictions`);
  if (!res.ok) {
    throw new Error(`Predictions not ready: ${inferenceId}`);
  }
  return res.arrayBuffer();
}

/** Download brain visualization (.png) from Python API. */
export async function getInferenceVisualization(
  inferenceId: string
): Promise<ArrayBuffer> {
  const res = await fetch(`${API_URL}/jobs/${inferenceId}/visualization`);
  if (!res.ok) {
    throw new Error(`Visualization not ready: ${inferenceId}`);
  }
  return res.arrayBuffer();
}
