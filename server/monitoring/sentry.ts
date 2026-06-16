import * as Sentry from '@sentry/node';
import { ProfilingIntegration } from '@sentry/profiling-node';

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
      new ProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.OnUncaughtException(),
      new Sentry.Integrations.OnUnhandledRejection(),
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
 * Express middleware for Sentry
 */
export function sentryMiddleware() {
  return [
    Sentry.Handlers.requestHandler(),
    Sentry.Handlers.tracingHandler(),
  ];
}

/**
 * Error handler middleware for Sentry
 */
export function sentryErrorHandler() {
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture exception with context
 */
export function captureException(error: Error, context: Record<string, any> = {}) {
  Sentry.withScope((scope: any) => {
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, value);
    });
    Sentry.captureException(error);
  });
}

/**
 * Capture message with level
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
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
 * Set tags for event filtering
 */
export function setTags(tags: Record<string, string>) {
  Object.entries(tags).forEach(([key, value]) => {
    Sentry.setTag(key, value);
  });
}

/**
 * Set extra context
 */
export function setExtra(key: string, value: any) {
  Sentry.setContext(key, value);
}

/**
 * Start performance transaction
 */
export function startTransaction(name: string, op: string) {
  return Sentry.startTransaction({
    name,
    op,
  });
}

/**
 * Capture AI provider performance
 */
export function captureAiProviderPerformance(
  provider: string,
  model: string,
  duration: number,
  tokensUsed: number,
  cost: number
) {
  const transaction = Sentry.startTransaction({
    name: `AI Provider: ${provider}`,
    op: 'ai.request',
  });

  transaction.setData('provider', provider);
  transaction.setData('model', model);
  transaction.setData('duration_ms', duration);
  transaction.setData('tokens_used', tokensUsed);
  transaction.setData('cost', cost);

  transaction.finish();
}

/**
 * Capture database query performance
 */
export function captureDbQueryPerformance(
  operation: string,
  table: string,
  duration: number,
  rowsAffected: number
) {
  const transaction = Sentry.startTransaction({
    name: `DB: ${operation} ${table}`,
    op: 'db.query',
  });

  transaction.setData('operation', operation);
  transaction.setData('table', table);
  transaction.setData('duration_ms', duration);
  transaction.setData('rows_affected', rowsAffected);

  transaction.finish();
}

/**
 * Capture Redis command performance
 */
export function captureRedisCommandPerformance(command: string, duration: number) {
  const transaction = Sentry.startTransaction({
    name: `Redis: ${command}`,
    op: 'redis.command',
  });

  transaction.setData('command', command);
  transaction.setData('duration_ms', duration);

  transaction.finish();
}

/**
 * Capture SSE event
 */
export function captureSseEvent(eventType: string, clientCount: number, deliveryTime: number) {
  const transaction = Sentry.startTransaction({
    name: `SSE: ${eventType}`,
    op: 'sse.event',
  });

  transaction.setData('event_type', eventType);
  transaction.setData('client_count', clientCount);
  transaction.setData('delivery_time_ms', deliveryTime);

  transaction.finish();
}

/**
 * Capture authentication event
 */
export function captureAuthEvent(eventType: 'login' | 'logout' | 'token_refresh', success: boolean, userId?: string) {
  const transaction = Sentry.startTransaction({
    name: `Auth: ${eventType}`,
    op: 'auth.event',
  });

  transaction.setData('event_type', eventType);
  transaction.setData('success', success);
  if (userId) {
    transaction.setData('user_id', userId);
  }

  transaction.finish();
}

/**
 * Flush Sentry before shutdown
 */
export async function flushSentry() {
  await Sentry.close(2000);
}

export default Sentry;
