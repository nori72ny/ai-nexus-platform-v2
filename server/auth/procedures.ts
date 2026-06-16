import { protectedProcedure, publicProcedure, adminProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb } from '../db';
import { users, tasks, reports } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import * as jwt from './jwt';
import bcrypt from 'bcrypt';
import { getSessionCookieOptions } from '../_core/cookies';
import { COOKIE_NAME } from '../../shared/const';



/**
 * Authentication router
 */
export const authRouter = router({
  /**
   * Get current user info
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    return {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      role: ctx.user.role,
    };
  }),

  /**
   * Refresh access token
   */
  refreshToken: publicProcedure
    .input(z.object({
      refreshToken: z.string(),
    }))
    .mutation(async ({ input }) => {
      const result = await jwt.refreshAccessToken(input.refreshToken);

      if (!result) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired refresh token',
        });
      }

      return result;
    }),

  /**
   * Logout (revoke all tokens)
   */
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      await jwt.revokeAllUserSessions(ctx.user.id);
      ctx.res.clearCookie(COOKIE_NAME, getSessionCookieOptions(ctx.req));
      return { success: true };
    } catch (error) {
      console.error('[Auth] Logout error:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to logout',
      });
    }
  }),

  /**
   * Change password
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(8),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Get user with password hash
      const userRecords = await db.select().from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const user = userRecords[0];

      // Verify current password
      if (!user.passwordHash || !await bcrypt.compare(input.currentPassword, user.passwordHash)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(input.newPassword, 12);

      // Update password
      try {
        await db.update(users)
          .set({
            passwordHash: newPasswordHash,
            lastPasswordChange: new Date(),
          })
          .where(eq(users.id, ctx.user.id));
      } catch (error) {
        console.error('[Auth] Password update error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update password',
        });
      }

      // Revoke all sessions
      await jwt.revokeAllUserSessions(ctx.user.id);

      return { success: true, message: 'Password changed successfully' };
    }),

  /**
   * Delete account
   */
  deleteAccount: protectedProcedure
    .input(z.object({
      password: z.string().min(8),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Get user with password hash
      const userRecords = await db.select().from(users)
        .where(eq(users.id, ctx.user.id))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const user = userRecords[0];

      // Verify password
      if (!user.passwordHash || !await bcrypt.compare(input.password, user.passwordHash)) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Password is incorrect',
        });
      }

      // Mark user as deleted
      await db.update(users)
        .set({ status: 'deleted' })
        .where(eq(users.id, ctx.user.id));

      // Revoke all sessions
      await jwt.revokeAllUserSessions(ctx.user.id);

      return { success: true, message: 'Account deleted successfully' };
    }),
});

/**
 * User management router (admin only)
 */
export const userManagementRouter = router({
  /**
   * List all users
   */
  list: adminProcedure
    .input(z.object({
      limit: z.number().default(50).pipe(z.number().max(100)),
      offset: z.number().default(0),
      role: z.enum(['admin', 'user', 'viewer']).optional(),
      status: z.enum(['active', 'suspended', 'deleted']).optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      let conditions: any[] = [];

      if (input.role) {
        conditions.push(eq(users.role, input.role));
      }

      if (input.status) {
        conditions.push(eq(users.status, input.status));
      }

      const whereClause = conditions.length > 0 ? conditions[0] : undefined;
      
      const total = await db.select().from(users)
        .where(whereClause);
      
      const items = await db.select().from(users)
        .where(whereClause)
        .limit(input.limit)
        .offset(input.offset);

      return {
        items: items.map(u => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          createdAt: u.createdAt,
          lastSignedIn: u.lastSignedIn,
        })),
        total: total.length,
        limit: input.limit,
        offset: input.offset,
      };
    }),

  /**
   * Get user details
   */
  getById: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userRecords = await db.select().from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRecords || userRecords.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const user = userRecords[0];
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        lastSignedIn: user.lastSignedIn,
        lastPasswordChange: user.lastPasswordChange,
      };
    }),

  /**
   * Update user role
   */
  updateRole: adminProcedure
    .input(z.object({
      userId: z.number(),
      role: z.enum(['admin', 'user', 'viewer']),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userRecords = await db.select().from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      await db.update(users)
        .set({ role: input.role })
        .where(eq(users.id, input.userId));

      return { success: true, message: `User role updated to ${input.role}` };
    }),

  /**
   * Suspend user
   */
  suspend: adminProcedure
    .input(z.object({
      userId: z.number(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userRecords = await db.select().from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      await db.update(users)
        .set({ status: 'suspended' })
        .where(eq(users.id, input.userId));

      // Revoke all sessions
      await jwt.revokeAllUserSessions(input.userId);

      return { success: true, message: 'User suspended successfully' };
    }),

  /**
   * Reactivate user
   */
  reactivate: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userRecords = await db.select().from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      await db.update(users)
        .set({ status: 'active' })
        .where(eq(users.id, input.userId));

      return { success: true, message: 'User reactivated successfully' };
    }),

  /**
   * Reset user password (admin)
   */
  resetPassword: adminProcedure
    .input(z.object({
      userId: z.number(),
      newPassword: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      const userRecords = await db.select().from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!userRecords.length) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, 12);

      await db.update(users)
        .set({
          passwordHash,
          lastPasswordChange: new Date(),
        })
        .where(eq(users.id, input.userId));

      // Revoke all sessions
      await jwt.revokeAllUserSessions(input.userId);

      return { success: true, message: 'Password reset successfully' };
    }),

  /**
   * Get user usage statistics
   */
  getUsageStats: adminProcedure
    .input(z.object({
      userId: z.number(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });

      // Get user tasks
      const userTasks = await db.select().from(tasks).where(
        eq(tasks.userId, input.userId)
      );

      // Get user reports
      const userReports = await db.select().from(reports).where(
        eq(reports.userId, input.userId)
      );

      return {
        totalTasks: userTasks.length,
        completedTasks: userTasks.filter(t => t.status === 'completed').length,
        totalReports: userReports.length,
        averageReportRating: 0, // Calculate from feedback
      };
    }),
});
