import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(), // UUID
  inferenceId: text("inference_id"), // ID from Python API (nullable until submitted)
  filename: text("filename").notNull(),
  fileSize: integer("file_size").notNull(),
  r2Key: text("r2_key"),
  status: text("status", {
    enum: ["queued", "running", "done", "failed"],
  })
    .notNull()
    .default("queued"),
  error: text("error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
