import { getDb } from '../db';
import { auditLogs } from '../../drizzle/schema';

/**
 * Audit log types
 */
export enum AuditLogType {
  // Authentication
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  LOGIN_FAILED = 'LOGIN_FAILED',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  // User management
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  USER_REACTIVATED = 'USER_REACTIVATED',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',

  // API access
  API_KEY_CREATED = 'API_KEY_CREATED',
  API_KEY_REVOKED = 'API_KEY_REVOKED',
  API_CALL = 'API_CALL',
  API_ERROR = 'API_ERROR',

  // Data operations
  DATA_CREATED = 'DATA_CREATED',
  DATA_UPDATED = 'DATA_UPDATED',
  DATA_DELETED = 'DATA_DELETED',
  DATA_EXPORTED = 'DATA_EXPORTED',

  // Admin actions
  ADMIN_ACTION = 'ADMIN_ACTION',
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',

  // Security events
  SECURITY_ALERT = 'SECURITY_ALERT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  UNAUTHORIZED_ACCESS = 'UNAUTHORIZED_ACCESS',
}

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  userId?: number;
  action: AuditLogType;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

/**
 * Audit logger
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn('[AuditLog] Database not available');
      return;
    }

    await db.insert(auditLogs).values({
      userId: entry.userId || null,
      action: entry.action,
      resource: entry.resource || null,
      resourceId: entry.resourceId || null,
      details: entry.details,
      ipAddress: entry.ipAddress || null,
      userAgent: entry.userAgent || null,
      status: entry.status,
      errorMessage: entry.errorMessage || null,
    });
  } catch (error) {
    console.error('[AuditLog] Failed to log audit entry:', error);
  }
}

/**
 * Log authentication event
 */
export async function logAuthEvent(
  userId: number,
  action: AuditLogType,
  status: 'success' | 'failure',
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  await logAudit({
    userId,
    action,
    resource: 'authentication',
    status,
    ipAddress,
    userAgent,
    errorMessage,
    details: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log user management event
 */
export async function logUserManagementEvent(
  adminId: number,
  action: AuditLogType,
  targetUserId: number,
  details: Record<string, any> = {},
  status: 'success' | 'failure' = 'success'
): Promise<void> {
  await logAudit({
    userId: adminId,
    action,
    resource: 'user',
    resourceId: String(targetUserId),
    status,
    details: {
      targetUserId,
      ...details,
    },
  });
}

/**
 * Log API call
 */
export async function logAPICall(
  userId: number | undefined,
  endpoint: string,
  method: string,
  statusCode: number,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  await logAudit({
    userId,
    action: statusCode >= 400 ? AuditLogType.API_ERROR : AuditLogType.API_CALL,
    resource: endpoint,
    status: statusCode < 400 ? 'success' : 'failure',
    ipAddress,
    userAgent,
    errorMessage,
    details: {
      method,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Log data operation
 */
export async function logDataOperation(
  userId: number,
  action: AuditLogType,
  resource: string,
  resourceId: string,
  details: Record<string, any> = {}
): Promise<void> {
  await logAudit({
    userId,
    action,
    resource,
    resourceId,
    status: 'success',
    details,
  });
}

/**
 * Log security event
 */
export async function logSecurityEvent(
  action: AuditLogType,
  resource: string,
  details: Record<string, any>,
  ipAddress?: string,
  userAgent?: string,
  errorMessage?: string
): Promise<void> {
  await logAudit({
    action,
    resource,
    status: 'failure',
    ipAddress,
    userAgent,
    errorMessage,
    details: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Query audit logs
 */
export async function queryAuditLogs(options: {
  userId?: number;
  action?: AuditLogType;
  resource?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) {
    console.warn('[AuditLog] Database not available');
    return [];
  }

  let query = db.select().from(auditLogs);

  // Note: Drizzle ORM filtering would require proper where clause
  // For now, return all results with pagination
  const results = await query
    .limit(options.limit || 100)
    .offset(options.offset || 0);

  return results;
}

/**
 * Get audit log summary
 */
export async function getAuditLogSummary(days: number = 7): Promise<{
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByResource: Record<string, number>;
  failureCount: number;
  securityEvents: number;
}> {
  const db = await getDb();
  if (!db) {
    throw new Error('Database not available');
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const logs = await db.select().from(auditLogs);

  const summary = {
    totalEvents: logs.length,
    eventsByType: {} as Record<string, number>,
    eventsByResource: {} as Record<string, number>,
    failureCount: 0,
    securityEvents: 0,
  };

  logs.forEach(log => {
    // Count by type
    summary.eventsByType[log.action] = (summary.eventsByType[log.action] || 0) + 1;

    // Count by resource
    if (log.resource) {
      summary.eventsByResource[log.resource] = (summary.eventsByResource[log.resource] || 0) + 1;
    }

    // Count failures
    if (log.status === 'failure') {
      summary.failureCount++;
    }

    // Count security events
    if ([
      AuditLogType.SECURITY_ALERT,
      AuditLogType.UNAUTHORIZED_ACCESS,
      AuditLogType.RATE_LIMIT_EXCEEDED,
      AuditLogType.LOGIN_FAILED,
    ].includes(log.action as AuditLogType)) {
      summary.securityEvents++;
    }
  });

  return summary;
}
