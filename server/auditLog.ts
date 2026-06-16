/**
 * Audit Log System
 * 全リクエストとユーザーアクションを記録
 */

import { createAuditLog } from "./db";
import type { Request } from "express";

export interface AuditLogEntry {
  userId?: number;
  action: string;
  resourceType?: string;
  resourceId?: string | number;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * リクエストからIPアドレスを抽出
 */
function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

/**
 * 監査ログを記録
 */
export async function logAudit(req: Request, entry: AuditLogEntry): Promise<void> {
  try {
    const ipAddress = getClientIp(req);
    const userAgent = req.headers["user-agent"];

    await createAuditLog(
      entry.userId,
      entry.action,
      entry.resourceType || undefined,
      entry.resourceId ? String(entry.resourceId) : undefined,
      entry.details,
      ipAddress,
      userAgent as string | undefined
    );
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}

/**
 * タスク作成ログ
 */
export async function logTaskCreated(req: Request, userId: number, taskId: number, taskTitle: string): Promise<void> {
  await logAudit(req, {
    userId,
    action: "TASK_CREATED",
    resourceType: "task",
    resourceId: taskId,
    details: { title: taskTitle },
  });
}

/**
 * タスク実行開始ログ
 */
export async function logTaskStarted(req: Request, userId: number, taskId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "TASK_STARTED",
    resourceType: "task",
    resourceId: taskId,
  });
}

/**
 * タスク完了ログ
 */
export async function logTaskCompleted(req: Request, userId: number, taskId: number, reportId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "TASK_COMPLETED",
    resourceType: "task",
    resourceId: taskId,
    details: { reportId },
  });
}

/**
 * タスク失敗ログ
 */
export async function logTaskFailed(req: Request, userId: number, taskId: number, error: string): Promise<void> {
  await logAudit(req, {
    userId,
    action: "TASK_FAILED",
    resourceType: "task",
    resourceId: taskId,
    details: { error },
  });
}

/**
 * レポート生成ログ
 */
export async function logReportGenerated(req: Request, userId: number, reportId: number, taskId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "REPORT_GENERATED",
    resourceType: "report",
    resourceId: reportId,
    details: { taskId },
  });
}

/**
 * レポート表示ログ
 */
export async function logReportViewed(req: Request, userId: number, reportId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "REPORT_VIEWED",
    resourceType: "report",
    resourceId: reportId,
  });
}

/**
 * PDF出力ログ
 */
export async function logPDFExported(req: Request, userId: number, reportId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "PDF_EXPORTED",
    resourceType: "report",
    resourceId: reportId,
  });
}

/**
 * ユーザーログイン
 */
export async function logUserLogin(req: Request, userId: number, email?: string): Promise<void> {
  await logAudit(req, {
    userId,
    action: "USER_LOGIN",
    details: { email },
  });
}

/**
 * ユーザーログアウト
 */
export async function logUserLogout(req: Request, userId: number): Promise<void> {
  await logAudit(req, {
    userId,
    action: "USER_LOGOUT",
  });
}

/**
 * API呼び出しログ
 */
export async function logAPICall(
  req: Request,
  userId: number | undefined,
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number
): Promise<void> {
  await logAudit(req, {
    userId,
    action: "API_CALL",
    details: {
      endpoint,
      method,
      statusCode,
      duration,
    },
  });
}

/**
 * エラーログ
 */
export async function logError(
  req: Request,
  userId: number | undefined,
  action: string,
  error: Error | string
): Promise<void> {
  await logAudit(req, {
    userId,
    action: `ERROR_${action}`,
    details: {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}
