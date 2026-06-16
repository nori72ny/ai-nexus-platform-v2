import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, tasks, reports, sections, citations, graphs, aiResults, auditLogs } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Task queries
export async function createTask(userId: number, title: string, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(tasks).values({
    userId,
    title,
    description,
    status: "pending",
  });
  
  return result;
}

export async function getTasksByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(tasks).where(eq(tasks.userId, userId));
}

export async function getTaskById(taskId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(tasks).where(eq(tasks.id, taskId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateTaskStatus(taskId: number, status: "pending" | "processing" | "completed" | "failed") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(tasks).set({ status }).where(eq(tasks.id, taskId));
}

// Report queries
export async function createReport(taskId: number, userId: number, title: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(reports).values({
    taskId,
    userId,
    title,
    status: "draft",
  });
  
  return result;
}

export async function getReportsByUser(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(reports).where(eq(reports.userId, userId));
}

export async function getReportById(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(reports).where(eq(reports.id, reportId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateReportStatus(reportId: number, status: "draft" | "completed" | "archived") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  await db.update(reports).set({ status }).where(eq(reports.id, reportId));
}

// Section queries
export async function createSection(reportId: number, sectionType: string, content: string, order: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(sections).values({
    reportId,
    sectionType: sectionType as any,
    content,
    order,
  });
  
  return result;
}

export async function getSectionsByReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(sections).where(eq(sections.reportId, reportId)).orderBy(sections.order);
}

// Citation queries
export async function createCitation(reportId: number, source: string, aiService: string, url?: string, confidence?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(citations).values({
    reportId,
    source,
    aiService,
    url,
    confidence: confidence ? String(confidence) as any : undefined,
  });
  
  return result;
}

export async function getCitationsByReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(citations).where(eq(citations.reportId, reportId));
}

// Graph queries
export async function createGraph(reportId: number, graphType: string, title: string, data: any, order: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(graphs).values({
    reportId,
    graphType,
    title,
    data,
    order,
  });
  
  return result;
}

export async function getGraphsByReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(graphs).where(eq(graphs.reportId, reportId)).orderBy(graphs.order);
}

// AI Results queries
export async function createAIResult(reportId: number, aiService: string, result: string, processingTime: number, confidence?: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const insertResult = await db.insert(aiResults).values({
    reportId,
    aiService,
    result,
    processingTime,
    confidence: confidence ? String(confidence) as any : undefined,
    status: "completed",
  });
  
  return insertResult;
}

export async function getAIResultsByReport(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(aiResults).where(eq(aiResults.reportId, reportId));
}

// Audit Log queries
export async function createAuditLog(userId: number | undefined, action: string, resourceType?: string, resourceId?: number, details?: any, ipAddress?: string, userAgent?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(auditLogs).values({
    userId,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress,
    userAgent,
  });
  
  return result;
}

export async function getAuditLogs(limit: number = 100, offset: number = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(auditLogs).orderBy(auditLogs.createdAt).limit(limit).offset(offset);
}

// TODO: add feature queries here as your schema grows.
