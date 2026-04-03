"use client";

import { useState, useCallback, useEffect } from "react";
import VideoUpload from "./VideoUpload";
import JobCard, { type Job } from "./JobCard";

export default function Dashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load existing jobs from DB on mount
  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data: Job[]) => {
        setJobs(
          data.map((j) => ({
            ...j,
            // DB returns fileSize, map for consistency
            fileSize: j.fileSize ?? 0,
          }))
        );
      })
      .catch(() => {
        // DB might not have any jobs yet
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUploadStart = useCallback((filename: string, size: number) => {
    setError(null);
    setJobs((prev) => [
      {
        id: `temp-${Date.now()}`,
        filename,
        fileSize: size,
        status: "uploading",
        createdAt: Date.now(),
      },
      ...prev,
    ]);
  }, []);

  const handleUploadComplete = useCallback(
    (result: { id: string; filename: string; size: number }) => {
      setJobs((prev) => {
        const withoutTemp = prev.filter((j) => !j.id.startsWith("temp-"));
        return [
          {
            id: result.id,
            filename: result.filename,
            fileSize: result.size,
            status: "queued" as const,
            createdAt: Date.now(),
          },
          ...withoutTemp,
        ];
      });
    },
    []
  );

  const handleUploadError = useCallback((errorMsg: string) => {
    setError(errorMsg);
    setJobs((prev) => prev.filter((j) => !j.id.startsWith("temp-")));
  }, []);

  const handleStatusChange = useCallback(
    (jobId: string, updates: Partial<Job>) => {
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j))
      );
    },
    []
  );

  const hasActiveJob = jobs.some(
    (j) =>
      j.status === "uploading" ||
      j.status === "queued" ||
      j.status === "running"
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <VideoUpload
        onUploadStart={handleUploadStart}
        onUploadComplete={handleUploadComplete}
        onUploadError={handleUploadError}
        disabled={hasActiveJob}
      />

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-500/10 px-5 py-4 text-sm text-red-400">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-sm text-neutral-500">
          Loading jobs...
        </div>
      ) : (
        jobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-500">
              Jobs
            </h2>
            {jobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}
