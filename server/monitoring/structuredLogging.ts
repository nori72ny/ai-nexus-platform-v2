import { getTraceContext } from './opentelemetry';

/**
 * Structured Logging Module
 * Provides JSON logging with OpenTelemetry correlation
 */

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

export type EventType =
  | 'auth_login_success'
  | 'auth_login_failure'
  | 'auth_logout'
  | 'auth_password_change'
  | 'api_key_registration'
  | 'api_key_update'
  | 'api_key_delete'
  | 'task_creation'
  | 'task_execution'
  | 'task_cancellation'
  | 'report_generation'
  | 'report_download'
  | 'admin_action'
  | 'ai_provider_call'
  | 'sse_event'
  | 'db_query'
  | 'redis_command'
  | 'rate_limit_exceeded'
  | 'security_violation'
  | 'system_error'
  | 'http_request'
  | 'http_response';

export interface StructuredLogEntry {
  timestamp: string;
  trace_id: string;
  span_id: string;
  request_id: string;
  user_id?: string;
  task_id?: string;
  report_generation?: string;
  report_revision?: string;
  log_level: LogLevel;
  service_name: string;
  environment: string;
  event_type: EventType;
  message: string;
  [key: string]: any;
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  eventType: EventType,
  message: string,
  level: LogLevel = 'info',
  context: Record<string, any> = {}
): StructuredLogEntry {
  const traceContext = getTraceContext();

  return {
    timestamp: new Date().toISOString(),
    trace_id: context.traceId || traceContext.traceId,
    span_id: context.spanId || traceContext.spanId,
    request_id: context.requestId || '',
    user_id: context.userId,
    task_id: context.taskId,
    report_generation: context.reportGeneration,
    report_revision: context.reportRevision,
    log_level: level,
    service_name: 'ai-nexus-platform',
    environment: process.env.NODE_ENV || 'development',
    event_type: eventType,
    message,
    ...context,
  };
}

/**
 * Logger service
 */
export class Logger {
  private static instance: Logger;

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  debug(eventType: EventType, message: string, context?: Record<string, any>) {
    const entry = createLogEntry(eventType, message, 'debug', context);
    console.log(JSON.stringify(entry));
  }

  info(eventType: EventType, message: string, context?: Record<string, any>) {
    const entry = createLogEntry(eventType, message, 'info', context);
    console.log(JSON.stringify(entry));
  }

  warning(eventType: EventType, message: string, context?: Record<string, any>) {
    const entry = createLogEntry(eventType, message, 'warning', context);
    console.warn(JSON.stringify(entry));
  }

  error(eventType: EventType, message: string, context?: Record<string, any>) {
    const entry = createLogEntry(eventType, message, 'error', context);
    console.error(JSON.stringify(entry));
  }

  critical(eventType: EventType, message: string, context?: Record<string, any>) {
    const entry = createLogEntry(eventType, message, 'critical', context);
    console.error(JSON.stringify(entry));
  }

  // Convenience methods
  authLoginSuccess(userId: string, context?: Record<string, any>) {
    this.info('auth_login_success', `User ${userId} logged in successfully`, {
      userId,
      ...context,
    });
  }

  authLoginFailure(email: string, reason: string, context?: Record<string, any>) {
    this.warning('auth_login_failure', `Login failed for ${email}: ${reason}`, {
      email,
      reason,
      ...context,
    });
  }

  authLogout(userId: string, context?: Record<string, any>) {
    this.info('auth_logout', `User ${userId} logged out`, {
      userId,
      ...context,
    });
  }

  taskCreation(userId: string, taskId: string, taskType: string, context?: Record<string, any>) {
    this.info('task_creation', `Task ${taskId} created by user ${userId}`, {
      userId,
      taskId,
      taskType,
      ...context,
    });
  }

  taskExecution(taskId: string, provider: string, model: string, context?: Record<string, any>) {
    this.info('task_execution', `Task ${taskId} executed with ${provider}/${model}`, {
      taskId,
      provider,
      model,
      ...context,
    });
  }

  reportGeneration(userId: string, reportId: string, taskId: string, context?: Record<string, any>) {
    this.info('report_generation', `Report ${reportId} generated for task ${taskId}`, {
      userId,
      reportGeneration: reportId,
      taskId,
      ...context,
    });
  }

  reportDownload(userId: string, reportId: string, format: string, context?: Record<string, any>) {
    this.info('report_download', `Report ${reportId} downloaded in ${format} format`, {
      userId,
      reportGeneration: reportId,
      format,
      ...context,
    });
  }

  aiProviderCall(provider: string, model: string, tokensUsed: number, duration: number, context?: Record<string, any>) {
    this.info('ai_provider_call', `AI call to ${provider}/${model} completed in ${duration}ms`, {
      provider,
      model,
      tokensUsed,
      duration,
      ...context,
    });
  }

  sseEvent(eventType: string, clientCount: number, context?: Record<string, any>) {
    this.debug('sse_event', `SSE event ${eventType} sent to ${clientCount} clients`, {
      eventType,
      clientCount,
      ...context,
    });
  }

  dbQuery(operation: string, table: string, duration: number, rowsAffected: number, context?: Record<string, any>) {
    this.debug('db_query', `DB ${operation} on ${table} completed in ${duration}ms`, {
      operation,
      table,
      duration,
      rowsAffected,
      ...context,
    });
  }

  redisCommand(command: string, duration: number, context?: Record<string, any>) {
    this.debug('redis_command', `Redis ${command} completed in ${duration}ms`, {
      command,
      duration,
      ...context,
    });
  }

  rateLimitExceeded(userId: string, endpoint: string, context?: Record<string, any>) {
    this.warning('rate_limit_exceeded', `Rate limit exceeded for user ${userId} on ${endpoint}`, {
      userId,
      endpoint,
      ...context,
    });
  }

  securityViolation(userId: string, violationType: string, context?: Record<string, any>) {
    this.critical('security_violation', `Security violation detected: ${violationType}`, {
      userId,
      violationType,
      ...context,
    });
  }

  systemError(errorMessage: string, errorCode: string, context?: Record<string, any>) {
    this.error('system_error', errorMessage, {
      errorCode,
      ...context,
    });
  }
}

export const logger = Logger.getInstance();

/**
 * Express middleware for structured logging
 */
export function loggingMiddleware(req: any, res: any, next: any) {
  const startTime = Date.now();

  // Store request metadata
  req.requestMetadata = {
    requestId: req.headers['x-request-id'] || `req_${Date.now()}`,
    traceId: req.headers['x-trace-id'],
    correlationId: req.headers['x-correlation-id'],
    userId: req.user?.id,
  };

  // Log request
  logger.debug('http_request' as any, `${req.method} ${req.path}`, {
    requestId: req.requestMetadata.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
  });

  // Log response
  const originalSend = res.send;
  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warning' : 'info';
    logger[level]('http_response' as any, `${req.method} ${req.path} ${statusCode}`, {
      requestId: req.requestMetadata.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      duration,
      userId: req.requestMetadata.userId,
    });

    return originalSend.call(this, data);
  };

  next();
}

export default logger;
