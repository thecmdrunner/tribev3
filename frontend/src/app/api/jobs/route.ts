import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs } from "@/lib/db/schema";

/** GET /api/jobs — list recent jobs, newest first */
export async function GET() {
  const recentJobs = db
    .select()
    .from(jobs)
    .orderBy(desc(jobs.createdAt))
    .limit(50)
    .all();

  return NextResponse.json(recentJobs);
}
