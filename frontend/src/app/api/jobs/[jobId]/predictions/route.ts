import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { getInferencePredictions } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  const job = db.select().from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status !== "done" || !job.inferenceId) {
    return NextResponse.json(
      { error: "Predictions not available yet" },
      { status: 409 }
    );
  }

  try {
    const data = await getInferencePredictions(job.inferenceId);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${job.filename}_predictions.npy"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch predictions from inference API" },
      { status: 502 }
    );
  }
}
