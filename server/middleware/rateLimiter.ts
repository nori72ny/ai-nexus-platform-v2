import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  statusCode?: number;
}

/**
 * In-memory rate limiter store
 */
class RateLimiterStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  /**
   * Check if request is allowed
   */
  isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      this.store.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (entry.count < config.maxRequests) {
      entry.count++;
      return true;
    }

    return false;
  }

  /**
   * Get remaining requests
   */
  getRemaining(key: string, config: RateLimitConfig): number {
    const entry = this.store.get(key);

    if (!entry || Date.now() > entry.resetTime) {
      return config.maxRequests;
    }

    return Math.max(0, config.maxRequests - entry.count);
  }

  /**
   * Get reset time
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    return entry?.resetTime || Date.now();
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.store.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.store.delete(key));
  }
}

const store = new RateLimiterStore();

// Cleanup every 5 minutes
setInterval(() => store.cleanup(), 5 * 60 * 1000);

/**
 * Global rate limiter middleware
 * 100 requests per 15 minutes
 */
export const globalRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const config: RateLimitConfig = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
      statusCode: 429,
      message: 'Too many requests, please try again later',
    };

    const key = `global:${req.ip || 'unknown'}`;

    if (!store.isAllowed(key, config)) {
      const resetTime = store.getResetTime(key);
      res.set('Retry-After', String(Math.ceil((resetTime - Date.now()) / 1000)));
      return res.status(config.statusCode || 429).json({
        error: config.message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
    }

    res.set('X-RateLimit-Limit', String(config.maxRequests));
    res.set('X-RateLimit-Remaining', String(store.getRemaining(key, config)));
    res.set('X-RateLimit-Reset', String(store.getResetTime(key)));

    next();
  } catch (error) {
    console.error('[RateLimiter] Global limiter error:', error);
    // On error, allow request to proceed
    next();
  }
};

/**
 * Per-user rate limiter middleware
 * 1000 requests per hour per user
 */
export const userRateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Extract user ID from JWT token or session
    const userId = (req as any).user?.id;

    if (!userId) {
      return next(); // Skip rate limiting for unauthenticated requests
    }

    const config: RateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 1000,
      statusCode: 429,
      message: 'User rate limit exceeded',
    };

    const key = `user:${userId}`;

    if (!store.isAllowed(key, config)) {
      const resetTime = store.getResetTime(key);
      res.set('Retry-After', String(Math.ceil((resetTime - Date.now()) / 1000)));
      return res.status(config.statusCode || 429).json({
        error: config.message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
    }

    res.set('X-RateLimit-Limit', String(config.maxRequests));
    res.set('X-RateLimit-Remaining', String(store.getRemaining(key, config)));
    res.set('X-RateLimit-Reset', String(store.getResetTime(key)));

    next();
  } catch (error) {
    console.error('[RateLimiter] User limiter error:', error);
    // On error, allow request to proceed
    next();
  }
};

/**
 * API endpoint rate limiter
 * 50 requests per minute per endpoint
 */
export const endpointRateLimiter = (endpoint: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const config: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 50,
      statusCode: 429,
      message: 'Endpoint rate limit exceeded',
    };

    const userId = (req as any).user?.id || req.ip;
    const key = `endpoint:${endpoint}:${userId}`;

    if (!store.isAllowed(key, config)) {
      const resetTime = store.getResetTime(key);
      res.set('Retry-After', String(Math.ceil((resetTime - Date.now()) / 1000)));
      return res.status(config.statusCode || 429).json({
        error: config.message,
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      });
    }

    res.set('X-RateLimit-Limit', String(config.maxRequests));
    res.set('X-RateLimit-Remaining', String(store.getRemaining(key, config)));
    res.set('X-RateLimit-Reset', String(store.getResetTime(key)));

    next();
  };
};

/**
 * IP whitelist/blacklist
 */
export class IPFilter {
  private whitelist: Set<string> = new Set();
  private blacklist: Set<string> = new Set();

  addToWhitelist(ip: string): void {
    this.whitelist.add(ip);
  }

  removeFromWhitelist(ip: string): void {
    this.whitelist.delete(ip);
  }

  addToBlacklist(ip: string): void {
    this.blacklist.add(ip);
  }

  removeFromBlacklist(ip: string): void {
    this.blacklist.delete(ip);
  }

  isAllowed(ip: string): boolean {
    if (this.blacklist.has(ip)) {
      return false;
    }

    if (this.whitelist.size > 0) {
      return this.whitelist.has(ip);
    }

    return true;
  }

  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const ip = req.ip || req.socket.remoteAddress || '';

      if (!this.isAllowed(ip)) {
        return res.status(403).json({
          error: 'Access denied',
        });
      }

      next();
    };
  }
}
