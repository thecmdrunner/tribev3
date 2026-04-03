import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getInferenceStatus } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  // If job is still in progress and we have an inference ID, sync with Python API
  if (
    job.inferenceId &&
    (job.status === "queued" || job.status === "running")
  ) {
    try {
      const inference = await getInferenceStatus(job.inferenceId);
      const newStatus = inference.status as string;

      if (newStatus !== job.status) {
        const updates: Record<string, unknown> = {
          status: newStatus,
          updatedAt: new Date(),
        };
        if (newStatus === "done") {
          updates.completedAt = new Date();
        }
        if (inference.error) {
          updates.error = inference.error;
        }

        db.update(jobs).set(updates).where(eq(jobs.id, jobId)).run();

        return NextResponse.json({
          id: job.id,
          filename: job.filename,
          fileSize: job.fileSize,
          status: newStatus,
          error: inference.error ?? job.error,
          createdAt: job.createdAt,
          updatedAt: new Date(),
          completedAt: newStatus === "done" ? new Date() : job.completedAt,
        });
      }
    } catch {
      // Python API unreachable — return DB state as-is
    }
  }

  return NextResponse.json({
    id: job.id,
    filename: job.filename,
    fileSize: job.fileSize,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  });
}
