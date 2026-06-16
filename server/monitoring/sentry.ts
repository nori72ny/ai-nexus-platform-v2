import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Sentry Configuration for Backend
 * Tracks exceptions, performance, and releases
 */

export function initializeSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '1.0.0',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
    ],
    beforeSend(event: any, hint: any) {
      // Filter out certain errors
      if (event.exception) {
        const error = hint.originalException;
        if (error instanceof Error) {
          // Don't send 404 errors
          if (error.message?.includes('404')) {
            return null;
          }
        }
      }
      return event;
    },
  });
}

/**
 * Express middleware for Sentry request handling
 */
export function sentryRequestHandler() {
  return (req: any, res: any, next: any) => {
    // Add request ID to Sentry context
    const requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
    Sentry.setTag('request_id', requestId);
    next();
  };
}

/**
 * Express middleware for Sentry error handling
 */
export function sentryErrorHandler() {
  return (err: any, req: any, res: any, next: any) => {
    Sentry.captureException(err);
    next(err);
  };
}

/**
 * Capture exception
 */
export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    contexts: {
      custom: context || {},
    },
  });
}

/**
 * Capture message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info') {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context
 */
export function setUserContext(userId: string, email?: string, username?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username,
  });
}

/**
 * Clear user context
 */
export function clearUserContext() {
  Sentry.setUser(null);
}

/**
 * Add breadcrumb
 */
export function addBreadcrumb(message: string, category: string, level: Sentry.SeverityLevel = 'info', data?: Record<string, any>) {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Set tag
 */
export function setTag(key: string, value: string | number | boolean) {
  Sentry.setTag(key, value);
}

/**
 * Set context
 */
export function setContext(name: string, context: Record<string, any>) {
  Sentry.setContext(name, context);
}

/**
 * Track API request performance
 */
export function trackApiRequest(method: string, path: string, statusCode: number, duration: number) {
  addBreadcrumb(`${method} ${path} - ${statusCode}`, 'http', statusCode >= 400 ? 'warning' : 'info', {
    statusCode,
    duration,
  });
}

/**
 * Track database query performance
 */
export function trackDatabaseQuery(query: string, duration: number, success: boolean) {
  addBreadcrumb(query.substring(0, 100), 'database', success ? 'info' : 'warning', {
    duration,
    success,
  });
}

/**
 * Track AI provider request performance
 */
export function trackAiProviderRequest(provider: string, model: string, duration: number, success: boolean, tokens?: number) {
  addBreadcrumb(`${provider} - ${model}`, 'ai', success ? 'info' : 'warning', {
    duration,
    success,
    tokens,
  });
}

/**
 * Track task execution
 */
export function trackTaskExecution(taskId: string, taskType: string, duration: number, success: boolean, result?: any) {
  addBreadcrumb(`Task: ${taskType}`, 'task', success ? 'info' : 'warning', {
    taskId,
    duration,
    success,
    result: result ? JSON.stringify(result).substring(0, 100) : undefined,
  });
}

/**
 * Track SSE event
 */
export function trackSseEvent(eventType: string, userId: string, data?: any) {
  addBreadcrumb(`SSE: ${eventType}`, 'sse', 'info', {
    userId,
    data: data ? JSON.stringify(data).substring(0, 100) : undefined,
  });
}

/**
 * Flush Sentry before process exit
 */
export async function flushSentry() {
  await Sentry.close(2000);
}
