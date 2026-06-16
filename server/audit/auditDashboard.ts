import { z } from 'zod';
import { protectedProcedure, adminProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { auditLogs } from '../../drizzle/schema';
import { desc, and, gte, lte, like, eq } from 'drizzle-orm';

/**
 * Audit Dashboard Router
 * Provides audit log querying, filtering, and export capabilities
 */

const auditLogFilterSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  userId: z.string().optional(),
  eventType: z.string().optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']).optional(),
  searchTerm: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

export const auditDashboardRouter = router({
  /**
   * Get audit logs with filtering
   */
  getLogs: adminProcedure
    .input(auditLogFilterSchema)
    .query(async ({ input }) => {
      const db = getDb();

      let query = db.select().from(auditLogs);

      // Apply filters
      const conditions = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.timestamp, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.timestamp, input.endDate));
      }

      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      if (input.eventType) {
        conditions.push(eq(auditLogs.eventType, input.eventType));
      }

      if (input.severity) {
        conditions.push(eq(auditLogs.severity, input.severity));
      }

      if (input.searchTerm) {
        conditions.push(like(auditLogs.details, `%${input.searchTerm}%`));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      // Get total count
      const countResult = await db
        .select({ count: auditLogs.id })
        .from(auditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      const total = countResult[0]?.count || 0;

      // Get paginated results
      const logs = await query
        .orderBy(desc(auditLogs.timestamp))
        .limit(input.limit)
        .offset(input.offset);

      return {
        logs,
        total,
        limit: input.limit,
        offset: input.offset,
        hasMore: input.offset + input.limit < total,
      };
    }),

  /**
   * Get audit log statistics
   */
  getStatistics: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = getDb();

      // Get event type distribution
      const eventDistribution = await db
        .select({
          eventType: auditLogs.eventType,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .groupBy(auditLogs.eventType);

      // Get severity distribution
      const severityDistribution = await db
        .select({
          severity: auditLogs.severity,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .groupBy(auditLogs.severity);

      // Get user activity
      const userActivity = await db
        .select({
          userId: auditLogs.userId,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .groupBy(auditLogs.userId)
        .orderBy(desc(auditLogs.id));

      return {
        eventDistribution,
        severityDistribution,
        topUsers: userActivity.slice(0, 10),
      };
    }),

  /**
   * Export audit logs as CSV
   */
  exportCsv: adminProcedure
    .input(auditLogFilterSchema)
    .query(async ({ input }) => {
      const db = getDb();

      let query = db.select().from(auditLogs);

      // Apply same filters as getLogs
      const conditions = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.timestamp, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.timestamp, input.endDate));
      }

      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      if (input.eventType) {
        conditions.push(eq(auditLogs.eventType, input.eventType));
      }

      if (input.severity) {
        conditions.push(eq(auditLogs.severity, input.severity));
      }

      if (input.searchTerm) {
        conditions.push(like(auditLogs.details, `%${input.searchTerm}%`));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const logs = await query.orderBy(desc(auditLogs.timestamp)).limit(10000);

      // Convert to CSV
      const headers = ['Timestamp', 'User ID', 'Event Type', 'Severity', 'Details', 'IP Address', 'User Agent'];
      const rows = logs.map((log) => [
        log.timestamp.toISOString(),
        log.userId,
        log.eventType,
        log.severity,
        log.details,
        log.ipAddress || '',
        log.userAgent || '',
      ]);

      const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');

      return {
        csv,
        filename: `audit-logs-${new Date().toISOString().split('T')[0]}.csv`,
      };
    }),

  /**
   * Export audit logs as JSON
   */
  exportJson: adminProcedure
    .input(auditLogFilterSchema)
    .query(async ({ input }) => {
      const db = getDb();

      let query = db.select().from(auditLogs);

      // Apply same filters as getLogs
      const conditions = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.timestamp, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.timestamp, input.endDate));
      }

      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      if (input.eventType) {
        conditions.push(eq(auditLogs.eventType, input.eventType));
      }

      if (input.severity) {
        conditions.push(eq(auditLogs.severity, input.severity));
      }

      if (input.searchTerm) {
        conditions.push(like(auditLogs.details, `%${input.searchTerm}%`));
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const logs = await query.orderBy(desc(auditLogs.timestamp)).limit(10000);

      return {
        json: JSON.stringify(logs, null, 2),
        filename: `audit-logs-${new Date().toISOString().split('T')[0]}.json`,
      };
    }),

  /**
   * Get unique users
   */
  getUsers: adminProcedure.query(async () => {
    const db = getDb();

    const users = await db
      .selectDistinct({ userId: auditLogs.userId })
      .from(auditLogs)
      .orderBy(auditLogs.userId);

    return users.map((u) => u.userId).filter(Boolean);
  }),

  /**
   * Get unique event types
   */
  getEventTypes: adminProcedure.query(async () => {
    const db = getDb();

    const eventTypes = await db
      .selectDistinct({ eventType: auditLogs.eventType })
      .from(auditLogs)
      .orderBy(auditLogs.eventType);

    return eventTypes.map((e) => e.eventType);
  }),
});

export default auditDashboardRouter;
