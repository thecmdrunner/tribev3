"use client";

import { useEffect, useState, useRef } from "react";

export interface Job {
  id: string;
  filename: string;
  fileSize: number;
  status: "uploading" | "queued" | "running" | "done" | "failed";
  error?: string | null;
  createdAt: string | number;
  completedAt?: string | number | null;
}

interface JobCardProps {
  job: Job;
  onStatusChange: (jobId: string, updates: Partial<Job>) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

const STATUS_CONFIG: Record<
  Job["status"],
  { label: string; color: string; bg: string }
> = {
  uploading: {
    label: "Uploading",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  queued: {
    label: "Queued",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
  },
  running: {
    label: "Running",
    color: "text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  done: {
    label: "Complete",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  failed: {
    label: "Failed",
    color: "text-red-400",
    bg: "bg-red-500/10",
  },
};

export default function JobCard({ job, onStatusChange }: JobCardProps) {
  const [elapsed, setElapsed] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const createdMs =
    typeof job.createdAt === "string"
      ? new Date(job.createdAt).getTime()
      : job.createdAt;

  // Poll job status from Next.js API (which syncs with Python)
  useEffect(() => {
    if (
      job.status === "done" ||
      job.status === "failed" ||
      job.status === "uploading"
    ) {
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/jobs/${job.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status !== job.status) {
          onStatusChange(job.id, {
            status: data.status,
            error: data.error,
            completedAt: data.completedAt,
          });
        }
      } catch {
        // Ignore transient errors
      }
    };

    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [job.id, job.status, onStatusChange]);

  // Elapsed time ticker
  useEffect(() => {
    if (job.status === "done" || job.status === "failed") {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }

    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - createdMs);
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [job.status, createdMs]);

  const cfg = STATUS_CONFIG[job.status];
  const isActive = job.status === "queued" || job.status === "running";

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-neutral-200">
            {job.filename}
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {formatBytes(job.fileSize)}
            {(isActive || job.status === "done") && (
              <span className="ml-2">&middot; {formatElapsed(elapsed)}</span>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${cfg.color} ${cfg.bg}`}
        >
          {isActive && (
            <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
          )}
          {cfg.label}
        </span>
      </div>

      {/* Error */}
      {job.status === "failed" && job.error && (
        <div className="border-t border-neutral-800 bg-red-500/5 px-5 py-3 text-sm text-red-400">
          {job.error}
        </div>
      )}

      {/* Results */}
      {job.status === "done" && (
        <div className="border-t border-neutral-800">
          <div className="p-5">
            <div className="mb-3 text-sm font-medium text-neutral-400">
              Brain Activation Map
            </div>
            <div className="overflow-hidden rounded-lg bg-neutral-950">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/jobs/${job.id}/visualization`}
                alt="Brain activation heatmap"
                className="w-full"
              />
            </div>
          </div>

          <div className="flex gap-3 border-t border-neutral-800 px-5 py-4">
            <a
              href={`/api/jobs/${job.id}/visualization`}
              download={`${job.filename}_brain.png`}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
            >
              <DownloadIcon />
              Brain Map (.png)
            </a>
            <a
              href={`/api/jobs/${job.id}/predictions`}
              download={`${job.filename}_predictions.npy`}
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-200 transition hover:bg-neutral-700"
            >
              <DownloadIcon />
              Raw Predictions (.npy)
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}
