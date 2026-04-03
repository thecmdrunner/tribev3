import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";
import { uploadToR2 } from "@/lib/r2";
import { submitInference } from "@/lib/api";

const ALLOWED_EXTENSIONS = new Set(["mp4", "mov", "avi", "mkv", "webm"]);
const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("video") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "No video file provided" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      {
        error: `Invalid file type: .${ext}. Accepted: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max size: 500MB" },
      { status: 400 }
    );
  }

  const jobId = randomUUID();
  const now = new Date();
  const arrayBuffer = await file.arrayBuffer();
  const r2Key = `videos/${jobId}-${file.name}`;

  // Create job in DB immediately
  db.insert(jobs)
    .values({
      id: jobId,
      filename: file.name,
      fileSize: file.size,
      status: "queued",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Upload to R2 and submit inference in parallel
  try {
    const [r2Url, inference] = await Promise.all([
      uploadToR2(r2Key, Buffer.from(arrayBuffer), file.type || "video/mp4"),
      submitInference(arrayBuffer, file.name),
    ]);

    db.update(jobs)
      .set({
        r2Key: r2Url,
        inferenceId: inference.job_id,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .run();

    return NextResponse.json({
      id: jobId,
      filename: file.name,
      size: file.size,
      status: "queued",
    });
  } catch (err) {
    db.update(jobs)
      .set({
        status: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId))
      .run();

    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    );
  }
}
