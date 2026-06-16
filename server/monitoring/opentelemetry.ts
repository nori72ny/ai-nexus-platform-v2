import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

/**
 * OpenTelemetry Configuration
 * Enables distributed tracing across frontend, backend, database, Redis, and AI providers
 */

// Initialize tracer provider
const resource = Resource.default().merge(
  new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'ai-nexus-platform',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  })
);

const tracerProvider = new BasicTracerProvider({
  resource,
});

// Configure OTLP exporter
const otlpExporter = new OTLPTraceExporter({
  url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  headers: {
    'Content-Type': 'application/json',
  },
});

tracerProvider.addSpanProcessor(new BatchSpanProcessor(otlpExporter));

// Initialize global tracer
trace.setGlobalTracerProvider(tracerProvider);

export const tracer = trace.getTracer('ai-nexus-tracer', '1.0.0');

/**
 * Generate Request ID and Trace ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateTraceId(): string {
  return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Express middleware for tracing
 */
export function tracingMiddleware(req: any, res: any, next: any) {
  const requestId = req.headers['x-request-id'] || generateRequestId();
  const traceId = req.headers['x-trace-id'] || generateTraceId();
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();

  // Store in request context
  req.requestId = requestId;
  req.traceId = traceId;
  req.correlationId = correlationId;

  // Add to response headers
  res.setHeader('x-request-id', requestId);
  res.setHeader('x-trace-id', traceId);
  res.setHeader('x-correlation-id', correlationId);

  // Start span
  const span = tracer.startSpan(`${req.method} ${req.path}`, {
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'http.host': req.hostname,
      'http.scheme': req.protocol,
      'http.client_ip': req.ip,
      'http.user_agent': req.get('user-agent'),
      'request.id': requestId,
      'trace.id': traceId,
      'correlation.id': correlationId,
    },
  });

  // Run in span context
  context.with(trace.setSpan(context.active(), span), () => {
    const originalSend = res.send;

    res.send = function (data: any) {
      span.setAttributes({
        'http.status_code': res.statusCode,
        'http.response_content_length': res.get('content-length') || 0,
      });

      if (res.statusCode >= 400) {
        span.setStatus({ code: SpanStatusCode.ERROR });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalSend.call(this, data);
    };

    next();
  });
}

/**
 * Trace database queries
 */
export function traceDbQuery(operation: string, table: string, fn: () => Promise<any>) {
  const span = tracer.startSpan(`db.${operation}`, {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': operation,
      'db.table': table,
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Trace Redis commands
 */
export function traceRedisCommand(command: string, fn: () => Promise<any>) {
  const span = tracer.startSpan(`redis.${command}`, {
    attributes: {
      'db.system': 'redis',
      'db.operation': command,
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Trace AI provider calls
 */
export function traceAiProviderCall(provider: string, model: string, fn: () => Promise<any>) {
  const span = tracer.startSpan(`ai.${provider}`, {
    attributes: {
      'ai.provider': provider,
      'ai.model': model,
      'span.kind': 'client',
    },
  });

  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Trace SSE events
 */
export function traceSseEvent(eventType: string, fn: () => void) {
  const span = tracer.startSpan(`sse.${eventType}`, {
    attributes: {
      'messaging.system': 'sse',
      'messaging.message_type': eventType,
    },
  });

  return context.with(trace.setSpan(context.active(), span), () => {
    try {
      fn();
      span.setStatus({ code: SpanStatusCode.OK });
    } catch (error: any) {
      span.recordException(error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Get current trace context
 */
export function getTraceContext() {
  const span = trace.getActiveSpan();
  if (!span) {
    return {
      traceId: generateTraceId(),
      spanId: '',
      isRecording: false,
    };
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    isRecording: span.isRecording(),
  };
}

/**
 * Shutdown tracer provider
 */
export async function shutdownTracer() {
  await tracerProvider.shutdown();
}

export default tracerProvider;
