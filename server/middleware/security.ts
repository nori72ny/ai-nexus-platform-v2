import { Express, Request, Response, NextFunction } from 'express';
import { globalRateLimiter, userRateLimiter, endpointRateLimiter, IPFilter } from './rateLimiter';
import { logAudit } from '../auditLog';

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; role: string };
    }
  }
}

/**
 * Security headers middleware
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // HSTS
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // CSP
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
  );

  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // X-XSS-Protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer-Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
}

/**
 * Request logging middleware
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();

  // Capture original send
  const originalSend = res.send;

  res.send = function (data: any) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log the request
    logAudit(req, {
      action: statusCode >= 400 ? 'API_ERROR' : 'API_CALL',
      resourceType: req.method,
      resourceId: req.path,
      details: {
        method: req.method,
        path: req.path,
        statusCode,
        duration,
        userAgent: req.headers['user-agent'],
      },
    }).catch(err => console.error('Failed to log request:', err));

    // Call original send
    return originalSend.call(this, data);
  };

  next();
}

/**
 * CORS middleware
 */
export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5173',
    process.env.FRONTEND_URL,
  ].filter(Boolean);

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '3600');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }

  next();
}

/**
 * CSRF token middleware
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Skip CSRF check for GET, HEAD, OPTIONS
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF check for API routes (they use JWT)
  if (req.path.startsWith('/api/')) {
    return next();
  }

  // For form submissions, verify CSRF token
  const csrfToken = req.headers['x-csrf-token'] || req.body?.csrfToken;

  if (!csrfToken) {
    return res.status(403).json({
      error: 'CSRF token missing',
    });
  }

  // In production, verify token against session
  // For now, just check it exists
  next();
}

/**
 * Input validation middleware
 */
export function inputValidation(req: Request, res: Response, next: NextFunction) {
  // Limit request body size
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);

    if (contentLength > 10 * 1024 * 1024) { // 10MB limit
      return res.status(413).json({
        error: 'Request body too large',
      });
    }
  }

  next();
}

/**
 * SQL injection prevention middleware
 */
export function sqlInjectionPrevention(req: Request, res: Response, next: NextFunction) {
  // Check for common SQL injection patterns
  const sqlPatterns = [
    /(\b(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|SCRIPT|JAVASCRIPT)\b)/gi,
    /(-{2}|\/\*|\*\/|xp_|sp_)/gi,
  ];

  const checkString = (str: string): boolean => {
    if (typeof str !== 'string') return false;
    return sqlPatterns.some(pattern => pattern.test(str));
  };

  // Check query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (checkString(String(value))) {
      return res.status(400).json({
        error: 'Invalid input detected',
      });
    }
  }

  // Check body parameters
  if (req.body && typeof req.body === 'object') {
    const checkObject = (obj: any): boolean => {
      for (const [key, value] of Object.entries(obj)) {
        if (checkString(String(value))) {
          return true;
        }
        if (typeof value === 'object' && value !== null) {
          if (checkObject(value)) return true;
        }
      }
      return false;
    };

    if (checkObject(req.body)) {
      return res.status(400).json({
        error: 'Invalid input detected',
      });
    }
  }

  next();
}

/**
 * Apply all security middleware to Express app
 */
export function applySecurity(app: Express) {
  // Security headers
  app.use(securityHeaders);

  // CORS
  app.use(corsMiddleware);

  // Input validation
  app.use(inputValidation);

  // SQL injection prevention
  app.use(sqlInjectionPrevention);

  // CSRF protection
  app.use(csrfProtection);

  // Rate limiting
  app.use(globalRateLimiter);
  app.use(userRateLimiter);

  // Request logging
  app.use(requestLogger);
}

/**
 * Create IP filter instance
 */
export const ipFilter = new IPFilter();

/**
 * Apply IP filtering to specific routes
 */
export function applyIPFilter(app: Express, routes: string[]) {
  routes.forEach(route => {
    app.use(route, ipFilter.middleware());
  });
}
