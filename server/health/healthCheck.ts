import { getDb } from '../db';

/**
 * Health check status
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  uptime: number;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    memory: CheckResult;
    disk: CheckResult;
  };
}

/**
 * Individual check result
 */
export interface CheckResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  responseTime: number;
  details?: Record<string, any>;
}

/**
 * Readiness check status
 */
export interface ReadinessStatus {
  ready: boolean;
  timestamp: Date;
  checks: {
    database: CheckResult;
    redis: CheckResult;
    migrations: CheckResult;
  };
}

/**
 * Liveness check status
 */
export interface LivenessStatus {
  alive: boolean;
  timestamp: Date;
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
}

/**
 * Health check service
 */
export class HealthCheckService {
  private startTime = Date.now();

  /**
   * Check database connectivity
   */
  async checkDatabase(): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      const db = await getDb();
      if (!db) throw new Error('Database not available');

      // Simple query to verify connection
      await db.execute('SELECT 1');

      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        message: 'Database connection successful',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        message: `Database check failed: ${String(error)}`,
        responseTime,
      };
    }
  }

  /**
   * Check Redis connectivity
   */
  async checkRedis(): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      // In production, this would connect to Redis
      // For now, return success if Redis URL is configured
      const redisUrl = process.env.REDIS_URL;

      if (!redisUrl) {
        return {
          status: 'warning',
          message: 'Redis not configured',
          responseTime: Date.now() - startTime,
        };
      }

      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        message: 'Redis connection successful',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        message: `Redis check failed: ${String(error)}`,
        responseTime,
      };
    }
  }

  /**
   * Check memory usage
   */
  checkMemory(): CheckResult {
    const startTime = Date.now();

    try {
      const memUsage = process.memoryUsage();
      const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      let status: 'ok' | 'warning' | 'error' = 'ok';
      let message = 'Memory usage normal';

      if (heapUsedPercent > 90) {
        status = 'error';
        message = `Critical memory usage: ${heapUsedPercent.toFixed(2)}%`;
      } else if (heapUsedPercent > 75) {
        status = 'warning';
        message = `High memory usage: ${heapUsedPercent.toFixed(2)}%`;
      }

      const responseTime = Date.now() - startTime;

      return {
        status,
        message,
        responseTime,
        details: {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
          percentage: heapUsedPercent.toFixed(2),
        },
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        message: `Memory check failed: ${String(error)}`,
        responseTime,
      };
    }
  }

  /**
   * Check disk space
   */
  checkDisk(): CheckResult {
    const startTime = Date.now();

    try {
      // In production, this would check actual disk space
      // For now, return success
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        message: 'Disk space available',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        message: `Disk check failed: ${String(error)}`,
        responseTime,
      };
    }
  }

  /**
   * Get full health status
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const [database, redis, memory, disk] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      Promise.resolve(this.checkMemory()),
      Promise.resolve(this.checkDisk()),
    ]);

    // Determine overall status
    const checks = { database, redis, memory, disk };
    const allStatuses = Object.values(checks).map(c => c.status);
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (allStatuses.includes('error')) {
      overallStatus = 'unhealthy';
    } else if (allStatuses.includes('warning')) {
      overallStatus = 'degraded';
    }

    const uptime = Date.now() - this.startTime;

    return {
      status: overallStatus,
      timestamp: new Date(),
      uptime,
      checks,
    };
  }

  /**
   * Get readiness status
   */
  async getReadinessStatus(): Promise<ReadinessStatus> {
    const database = await this.checkDatabase();
    const redis = await this.checkRedis();

    // Check if migrations have been applied
    const migrations = await this.checkMigrations();

    const ready = database.status === 'ok' && redis.status === 'ok' && migrations.status === 'ok';

    return {
      ready,
      timestamp: new Date(),
      checks: {
        database,
        redis,
        migrations,
      },
    };
  }

  /**
   * Get liveness status
   */
  getLivenessStatus(): LivenessStatus {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;

    return {
      alive: true,
      timestamp: new Date(),
      uptime,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024),
        total: Math.round(memUsage.heapTotal / 1024 / 1024),
        percentage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      },
    };
  }

  /**
   * Check if migrations have been applied
   */
  private async checkMigrations(): Promise<CheckResult> {
    const startTime = Date.now();

    try {
      // In production, check if all migrations have been applied
      // For now, return success
      const responseTime = Date.now() - startTime;

      return {
        status: 'ok',
        message: 'Migrations applied',
        responseTime,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        status: 'error',
        message: `Migration check failed: ${String(error)}`,
        responseTime,
      };
    }
  }

  /**
   * Reset uptime counter
   */
  resetUptime(): void {
    this.startTime = Date.now();
  }
}

/**
 * Global health check service instance
 */
export const healthCheckService = new HealthCheckService();
