import { Express, Request, Response } from 'express';
import { healthCheckService } from '../health/healthCheck';

/**
 * Register health check HTTP endpoints
 */
export function registerHealthEndpoints(app: Express) {
  /**
   * Liveness probe - /live
   * Returns 200 if the application is running
   * Used by Kubernetes/container orchestration
   */
  app.get('/live', async (req: Request, res: Response) => {
    try {
      const status = healthCheckService.getLivenessStatus();

      res.status(200).json({
        status: 'alive',
        data: status,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Readiness probe - /ready
   * Returns 200 if the application is ready to accept traffic
   * Used by load balancers and orchestration systems
   */
  app.get('/ready', async (req: Request, res: Response) => {
    try {
      const status = await healthCheckService.getReadinessStatus();

      if (status.ready) {
        res.status(200).json({
          status: 'ready',
          data: status,
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          data: status,
        });
      }
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Health check endpoint - /health
   * Returns detailed health status of all components
   * Used for monitoring and alerting
   */
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const status = await healthCheckService.getHealthStatus();

      const statusCode = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        status: status.status,
        data: status,
      });
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Database health check - /health/db
   * Returns database connectivity status
   */
  app.get('/health/db', async (req: Request, res: Response) => {
    try {
      const result = await healthCheckService['checkDatabase']();

      const statusCode = result.status === 'ok' ? 200 : result.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Redis health check - /health/redis
   * Returns Redis connectivity status
   */
  app.get('/health/redis', async (req: Request, res: Response) => {
    try {
      const result = await healthCheckService['checkRedis']();

      const statusCode = result.status === 'ok' ? 200 : result.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Memory health check - /health/memory
   * Returns memory usage status
   */
  app.get('/health/memory', async (req: Request, res: Response) => {
    try {
      const result = healthCheckService['checkMemory']();

      const statusCode = result.status === 'ok' ? 200 : result.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Disk health check - /health/disk
   * Returns disk space status
   */
  app.get('/health/disk', async (req: Request, res: Response) => {
    try {
      const result = healthCheckService['checkDisk']();

      const statusCode = result.status === 'ok' ? 200 : result.status === 'warning' ? 200 : 503;

      res.status(statusCode).json(result);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });

  /**
   * Metrics endpoint - /metrics
   * Returns Prometheus-compatible metrics
   */
  app.get('/metrics', async (req: Request, res: Response) => {
    try {
      const health = await healthCheckService.getHealthStatus();
      const memory = process.memoryUsage();
      const uptime = process.uptime();

      const metrics = `# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds gauge
app_uptime_seconds ${uptime}

# HELP app_memory_heap_used_bytes Heap memory used in bytes
# TYPE app_memory_heap_used_bytes gauge
app_memory_heap_used_bytes ${memory.heapUsed}

# HELP app_memory_heap_total_bytes Total heap memory in bytes
# TYPE app_memory_heap_total_bytes gauge
app_memory_heap_total_bytes ${memory.heapTotal}

# HELP app_health_status Application health status (1=healthy, 0=degraded, -1=unhealthy)
# TYPE app_health_status gauge
app_health_status ${health.status === 'healthy' ? 1 : health.status === 'degraded' ? 0 : -1}

# HELP app_database_check Database connectivity check (1=ok, 0=warning, -1=error)
# TYPE app_database_check gauge
app_database_check ${health.checks.database.status === 'ok' ? 1 : health.checks.database.status === 'warning' ? 0 : -1}

# HELP app_redis_check Redis connectivity check (1=ok, 0=warning, -1=error)
# TYPE app_redis_check gauge
app_redis_check ${health.checks.redis.status === 'ok' ? 1 : health.checks.redis.status === 'warning' ? 0 : -1}

# HELP app_memory_check Memory usage check (1=ok, 0=warning, -1=error)
# TYPE app_memory_check gauge
app_memory_check ${health.checks.memory.status === 'ok' ? 1 : health.checks.memory.status === 'warning' ? 0 : -1}

# HELP app_disk_check Disk space check (1=ok, 0=warning, -1=error)
# TYPE app_disk_check gauge
app_disk_check ${health.checks.disk.status === 'ok' ? 1 : health.checks.disk.status === 'warning' ? 0 : -1}
`;

      res.setHeader('Content-Type', 'text/plain; version=0.0.4');
      res.status(200).send(metrics);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        message: String(error),
      });
    }
  });
}
