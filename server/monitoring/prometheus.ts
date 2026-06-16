import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

/**
 * Prometheus Metrics Collection
 * Tracks all backend operations, API calls, database queries, and AI provider interactions
 */

// Initialize default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

// ============================================================================
// API Metrics
// ============================================================================

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

export const httpRequestSize = new Histogram({
  name: 'http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

export const httpResponseSize = new Histogram({
  name: 'http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'route', 'status'],
  buckets: [100, 1000, 10000, 100000, 1000000],
  registers: [register],
});

// ============================================================================
// Error Metrics
// ============================================================================

export const errorsTotal = new Counter({
  name: 'errors_total',
  help: 'Total errors',
  labelNames: ['type', 'code', 'service'],
  registers: [register],
});

export const errorRate = new Gauge({
  name: 'error_rate',
  help: 'Current error rate (errors per minute)',
  labelNames: ['service'],
  registers: [register],
});

// ============================================================================
// Database Metrics
// ============================================================================

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Database query latency in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
  registers: [register],
});

export const dbConnectionsActive = new Gauge({
  name: 'db_connections_active',
  help: 'Active database connections',
  registers: [register],
});

export const dbConnectionsIdle = new Gauge({
  name: 'db_connections_idle',
  help: 'Idle database connections',
  registers: [register],
});

export const dbConnectionsWaiting = new Gauge({
  name: 'db_connections_waiting',
  help: 'Waiting database connections',
  registers: [register],
});

export const dbQueryErrors = new Counter({
  name: 'db_query_errors_total',
  help: 'Total database query errors',
  labelNames: ['operation', 'table', 'error_code'],
  registers: [register],
});

// ============================================================================
// Redis Metrics
// ============================================================================

export const redisCommandDuration = new Histogram({
  name: 'redis_command_duration_seconds',
  help: 'Redis command latency in seconds',
  labelNames: ['command'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1],
  registers: [register],
});

export const redisConnectionsActive = new Gauge({
  name: 'redis_connections_active',
  help: 'Active Redis connections',
  registers: [register],
});

export const redisMemoryUsage = new Gauge({
  name: 'redis_memory_usage_bytes',
  help: 'Redis memory usage in bytes',
  registers: [register],
});

export const redisKeyCount = new Gauge({
  name: 'redis_key_count',
  help: 'Total Redis keys',
  registers: [register],
});

export const redisCommandErrors = new Counter({
  name: 'redis_command_errors_total',
  help: 'Total Redis command errors',
  labelNames: ['command', 'error_code'],
  registers: [register],
});

// ============================================================================
// SSE Metrics
// ============================================================================

export const sseConnectionsActive = new Gauge({
  name: 'sse_connections_active',
  help: 'Active SSE connections',
  registers: [register],
});

export const sseConnectionsTotal = new Counter({
  name: 'sse_connections_total',
  help: 'Total SSE connections established',
  registers: [register],
});

export const sseEventsPublished = new Counter({
  name: 'sse_events_published_total',
  help: 'Total SSE events published',
  labelNames: ['event_type'],
  registers: [register],
});

export const sseEventDeliveryTime = new Histogram({
  name: 'sse_event_delivery_time_seconds',
  help: 'SSE event delivery time in seconds',
  labelNames: ['event_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const sseReconnects = new Counter({
  name: 'sse_reconnects_total',
  help: 'Total SSE reconnections',
  registers: [register],
});

// ============================================================================
// AI Provider Metrics
// ============================================================================

export const aiProviderRequestDuration = new Histogram({
  name: 'ai_provider_request_duration_seconds',
  help: 'AI provider request latency in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
  registers: [register],
});

export const aiProviderRequestsTotal = new Counter({
  name: 'ai_provider_requests_total',
  help: 'Total AI provider requests',
  labelNames: ['provider', 'model', 'status'],
  registers: [register],
});

export const aiProviderErrors = new Counter({
  name: 'ai_provider_errors_total',
  help: 'Total AI provider errors',
  labelNames: ['provider', 'error_code'],
  registers: [register],
});

export const aiProviderTokensUsed = new Counter({
  name: 'ai_provider_tokens_used_total',
  help: 'Total tokens used by AI provider',
  labelNames: ['provider', 'model', 'token_type'],
  registers: [register],
});

export const aiProviderCost = new Counter({
  name: 'ai_provider_cost_total',
  help: 'Total cost of AI provider usage',
  labelNames: ['provider', 'model'],
  registers: [register],
});

export const aiProviderHealthStatus = new Gauge({
  name: 'ai_provider_health_status',
  help: 'AI provider health status (1=healthy, 0=unhealthy)',
  labelNames: ['provider'],
  registers: [register],
});

export const aiProviderResponseTime = new Histogram({
  name: 'ai_provider_response_time_seconds',
  help: 'AI provider response time in seconds',
  labelNames: ['provider', 'model'],
  buckets: [0.5, 1, 2, 5, 10, 30, 60],
  registers: [register],
});

// ============================================================================
// Authentication Metrics
// ============================================================================

export const authLoginAttempts = new Counter({
  name: 'auth_login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['status'],
  registers: [register],
});

export const authTokenRefresh = new Counter({
  name: 'auth_token_refresh_total',
  help: 'Total token refreshes',
  registers: [register],
});

export const authTokenBlacklist = new Gauge({
  name: 'auth_token_blacklist_size',
  help: 'Size of token blacklist',
  registers: [register],
});

export const authActiveSessions = new Gauge({
  name: 'auth_active_sessions',
  help: 'Active user sessions',
  registers: [register],
});

// ============================================================================
// Rate Limiting Metrics
// ============================================================================

export const rateLimitExceeded = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total rate limit exceeded events',
  labelNames: ['endpoint', 'user_tier'],
  registers: [register],
});

export const rateLimitCurrent = new Gauge({
  name: 'rate_limit_current',
  help: 'Current rate limit usage',
  labelNames: ['endpoint', 'user_id'],
  registers: [register],
});

// ============================================================================
// Task Metrics
// ============================================================================

export const tasksCreated = new Counter({
  name: 'tasks_created_total',
  help: 'Total tasks created',
  labelNames: ['task_type'],
  registers: [register],
});

export const tasksCompleted = new Counter({
  name: 'tasks_completed_total',
  help: 'Total tasks completed',
  labelNames: ['task_type', 'status'],
  registers: [register],
});

export const tasksDuration = new Histogram({
  name: 'tasks_duration_seconds',
  help: 'Task execution duration in seconds',
  labelNames: ['task_type'],
  buckets: [1, 5, 10, 30, 60, 300, 900],
  registers: [register],
});

export const tasksActive = new Gauge({
  name: 'tasks_active',
  help: 'Active tasks',
  labelNames: ['task_type'],
  registers: [register],
});

// ============================================================================
// User Metrics
// ============================================================================

export const activeUsers = new Gauge({
  name: 'active_users',
  help: 'Currently active users',
  registers: [register],
});

export const totalUsers = new Gauge({
  name: 'total_users',
  help: 'Total registered users',
  registers: [register],
});

export const usersPerTier = new Gauge({
  name: 'users_per_tier',
  help: 'Users per subscription tier',
  labelNames: ['tier'],
  registers: [register],
});

// ============================================================================
// Cache Metrics
// ============================================================================

export const cacheHits = new Counter({
  name: 'cache_hits_total',
  help: 'Total cache hits',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheMisses = new Counter({
  name: 'cache_misses_total',
  help: 'Total cache misses',
  labelNames: ['cache_type'],
  registers: [register],
});

export const cacheSize = new Gauge({
  name: 'cache_size_bytes',
  help: 'Cache size in bytes',
  labelNames: ['cache_type'],
  registers: [register],
});

// ============================================================================
// System Metrics
// ============================================================================

export const systemUptime = new Gauge({
  name: 'system_uptime_seconds',
  help: 'System uptime in seconds',
  registers: [register],
});

export const systemMemoryUsage = new Gauge({
  name: 'system_memory_usage_bytes',
  help: 'System memory usage in bytes',
  registers: [register],
});

export const systemCpuUsage = new Gauge({
  name: 'system_cpu_usage_percent',
  help: 'System CPU usage percentage',
  registers: [register],
});

export const systemDiskUsage = new Gauge({
  name: 'system_disk_usage_percent',
  help: 'System disk usage percentage',
  registers: [register],
});

// ============================================================================
// Metrics Export
// ============================================================================

export function getMetricsRegistry() {
  return register;
}

export function getMetricsAsString() {
  return register.metrics();
}

/**
 * Middleware to track HTTP request metrics
 */
export function metricsMiddleware(req: any, res: any, next: any) {
  const start = Date.now();
  const originalSend = res.send;

  res.send = function (data: any) {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path || 'unknown';
    const method = req.method;
    const status = res.statusCode;

    httpRequestsTotal.labels(method, route, status).inc();
    httpRequestDuration.labels(method, route, status).observe(duration);

    if (req.get('content-length')) {
      httpRequestSize.labels(method, route).observe(parseInt(req.get('content-length')));
    }

    if (res.get('content-length')) {
      httpResponseSize.labels(method, route, status).observe(parseInt(res.get('content-length')));
    }

    return originalSend.call(this, data);
  };

  next();
}

/**
 * Helper to record database query metrics
 */
export function recordDbQuery(operation: string, table: string, duration: number, error?: Error) {
  dbQueryDuration.labels(operation, table).observe(duration / 1000);
  if (error) {
    dbQueryErrors.labels(operation, table, error.message).inc();
  }
}

/**
 * Helper to record Redis command metrics
 */
export function recordRedisCommand(command: string, duration: number, error?: Error) {
  redisCommandDuration.labels(command).observe(duration / 1000);
  if (error) {
    redisCommandErrors.labels(command, error.message).inc();
  }
}

/**
 * Helper to record AI provider request metrics
 */
export function recordAiProviderRequest(
  provider: string,
  model: string,
  duration: number,
  status: 'success' | 'error',
  tokensUsed?: number,
  cost?: number,
  error?: Error
) {
  aiProviderRequestDuration.labels(provider, model).observe(duration / 1000);
  aiProviderRequestsTotal.labels(provider, model, status).inc();

  if (tokensUsed) {
    aiProviderTokensUsed.labels(provider, model, 'total').inc(tokensUsed);
  }

  if (cost) {
    aiProviderCost.labels(provider, model).inc(cost);
  }

  if (error) {
    aiProviderErrors.labels(provider, error.message).inc();
  }
}

/**
 * Helper to record SSE event metrics
 */
export function recordSseEvent(eventType: string, deliveryTime: number) {
  sseEventsPublished.labels(eventType).inc();
  sseEventDeliveryTime.labels(eventType).observe(deliveryTime / 1000);
}
