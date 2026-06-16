import { z } from 'zod';
import { protectedProcedure, adminProcedure, router } from '../_core/trpc';
import { getDb } from '../db';
import { auditLogs } from '../../drizzle/schema';
import { desc, and, gte, lte, like, eq } from 'drizzle-orm';

const auditLogFilterSchema = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  userId: z.number().optional(),
  action: z.string().optional(),
  searchTerm: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
});

export const auditDashboardRouter = router({
  getLogs: adminProcedure
    .input(auditLogFilterSchema)
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const conditions: any[] = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      if (input.userId) {
        conditions.push(eq(auditLogs.userId, input.userId));
      }

      if (input.action) {
        conditions.push(eq(auditLogs.action, input.action));
      }

      if (input.searchTerm) {
        conditions.push(like(auditLogs.details, `%${input.searchTerm}%`));
      }

      const whereClause = conditions.length > 0 ? and(...(conditions as any)) : undefined;

      const countResult = await db
        .select({ count: auditLogs.id })
        .from(auditLogs)
        .where(whereClause);

      const total = countResult[0]?.count || 0;

      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt))
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

  getStatistics: adminProcedure
    .input(
      z.object({
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const conditions: any[] = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const whereClause = conditions.length > 0 ? and(...(conditions as any)) : undefined;

      const actionDistribution = await db
        .select({
          action: auditLogs.action,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.action);

      const statusDistribution = await db
        .select({
          status: auditLogs.status,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.status);

      const userActivity = await db
        .select({
          userId: auditLogs.userId,
          count: auditLogs.id,
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.userId);

      return {
        actionDistribution,
        statusDistribution,
        topUsers: userActivity.slice(0, 10),
      };
    }),

  exportAuditLogs: adminProcedure
    .input(
      z.object({
        format: z.enum(['csv', 'json']),
        startDate: z.date().optional(),
        endDate: z.date().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error('Database connection failed');

      const conditions: any[] = [];

      if (input.startDate) {
        conditions.push(gte(auditLogs.createdAt, input.startDate));
      }

      if (input.endDate) {
        conditions.push(lte(auditLogs.createdAt, input.endDate));
      }

      const whereClause = conditions.length > 0 ? and(...(conditions as any)) : undefined;

      const logs = await db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(desc(auditLogs.createdAt));

      if (input.format === 'json') {
        return {
          format: 'json',
          data: logs,
          filename: `audit-logs-${new Date().toISOString()}.json`,
        };
      }

      const headers = ['ID', 'User ID', 'Action', 'Resource', 'Status', 'Created At'];
      const rows = logs.map((log: any) => [
        log.id,
        log.userId || '',
        log.action,
        log.resource || '',
        log.status || '',
        log.createdAt?.toISOString() || '',
      ]);

      const csv = [headers, ...rows].map((row: any[]) => row.map((cell: any) => `"${cell}"`).join(',')).join('\n');

      return {
        format: input.format,
        data: csv,
        filename: `audit-logs-${new Date().toISOString()}.csv`,
      };
    }),

  getActions: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) throw new Error('Database connection failed');

    const actions = await db
      .selectDistinct({ action: auditLogs.action })
      .from(auditLogs)
      .orderBy(auditLogs.action);

    return actions.map((a: any) => a.action);
  }),
});

export default auditDashboardRouter;
