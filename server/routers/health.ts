import { publicProcedure, router } from '../_core/trpc';
import { healthCheckService } from '../health/healthCheck';

/**
 * Health check router
 */
export const healthRouter = router({
  /**
   * Liveness probe - indicates if the application is running
   */
  live: publicProcedure.query(async () => {
    return healthCheckService.getLivenessStatus();
  }),

  /**
   * Readiness probe - indicates if the application is ready to accept traffic
   */
  ready: publicProcedure.query(async () => {
    return healthCheckService.getReadinessStatus();
  }),

  /**
   * Full health check - detailed status of all components
   */
  health: publicProcedure.query(async () => {
    return healthCheckService.getHealthStatus();
  }),

  /**
   * Database health check
   */
  database: publicProcedure.query(async () => {
    return healthCheckService['checkDatabase']();
  }),

  /**
   * Redis health check
   */
  redis: publicProcedure.query(async () => {
    return healthCheckService['checkRedis']();
  }),

  /**
   * Memory health check
   */
  memory: publicProcedure.query(async () => {
    return healthCheckService['checkMemory']();
  }),

  /**
   * Disk health check
   */
  disk: publicProcedure.query(async () => {
    return healthCheckService['checkDisk']();
  }),
});
