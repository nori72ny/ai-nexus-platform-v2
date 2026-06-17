import { Express, Request, Response } from "express";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { tasks } from "../../drizzle/schema";

/**
 * Process pending tasks automatically via Heartbeat scheduler
 * Called every minute by the Heartbeat service
 */
export async function processPendingTasks(req: Request, res: Response) {
  try {
    console.log("[Scheduled] Processing pending tasks");

    const db = await getDb();
    if (!db) {
      console.error("[Scheduled] Database connection failed");
      return res.status(500).json({ error: "Database connection failed" });
    }

    // Get all pending tasks
    const pendingTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "pending"))
      .limit(10); // Process max 10 tasks per run

    console.log(`[Scheduled] Found ${pendingTasks.length} pending tasks`);

    if (pendingTasks.length === 0) {
      return res.json({ processed: 0, message: "No pending tasks" });
    }

    // Queue each pending task for processing
    const results = [];
    for (const task of pendingTasks) {
      try {
        // Update status to processing
        await db
          .update(tasks)
          .set({ status: "processing" })
          .where(eq(tasks.id, task.id));

        console.log(`[Scheduled] Processing task ${task.id}`);

        results.push({
          taskId: task.id,
          status: "processing",
          title: task.title,
        });
      } catch (error) {
        console.error(`[Scheduled] Failed to process task ${task.id}:`, error);
        results.push({
          taskId: task.id,
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    console.log(`[Scheduled] Processed ${results.length} tasks`);
    res.json({
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Scheduled] Error processing pending tasks:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Register scheduled task routes
 */
export function registerScheduledRoutes(app: Express) {
  // Process pending tasks endpoint
  app.post("/api/scheduled/process-pending-tasks", processPendingTasks);

  console.log("[Routes] Scheduled task routes registered");
}
