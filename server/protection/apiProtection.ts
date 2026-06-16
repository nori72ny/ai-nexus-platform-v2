import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator: (req: Request) => string; // Function to generate rate limit key
}

/**
 * Rate limit store entry
 */
interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * API key validation result
 */
export interface APIKeyValidationResult {
  valid: boolean;
  userId?: string;
  tier?: 'free' | 'pro' | 'enterprise';
  rateLimitRemaining?: number;
}

/**
 * Abuse detection result
 */
export interface AbuseDetectionResult {
  isAbuse: boolean;
  score: number;
  reason?: string;
}

/**
 * Rate limiter service
 */
export class RateLimiterService {
  private store = new Map<string, RateLimitEntry>();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    this.initializeDefaultConfigs();
    this.startCleanup();
  }

  /**
   * Initialize default rate limit configurations
   */
  private initializeDefaultConfigs(): void {
    // Global rate limit: 1000 requests per 15 minutes
    this.configs.set('global', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 1000,
      keyGenerator: () => 'global',
    });

    // Per-user rate limit: 100 requests per minute
    this.configs.set('user', {
      windowMs: 60 * 1000,
      maxRequests: 100,
      keyGenerator: (req: Request) => `user:${(req as any).userId || req.ip}`,
    });

    // API endpoint rate limit: 50 requests per minute
    this.configs.set('api', {
      windowMs: 60 * 1000,
      maxRequests: 50,
      keyGenerator: (req: Request) => `api:${req.path}:${req.ip}`,
    });

    // Authentication endpoint rate limit: 5 requests per 15 minutes
    this.configs.set('auth', {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
      keyGenerator: (req: Request) => `auth:${req.ip}`,
    });
  }

  /**
   * Check rate limit
   */
  checkRateLimit(configName: string, req: Request): { allowed: boolean; remaining: number; resetTime: number } {
    const config = this.configs.get(configName);
    if (!config) {
      throw new Error(`Rate limit config not found: ${configName}`);
    }

    const key = config.keyGenerator(req);
    const now = Date.now();
    let entry = this.store.get(key);

    // Reset if window has expired
    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      this.store.set(key, entry);
    }

    const allowed = entry.count < config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - entry.count - 1);

    if (allowed) {
      entry.count++;
    }

    return {
      allowed,
      remaining,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Start cleanup timer to remove expired entries
   */
  private startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.store.forEach((entry, key) => {
        if (now > entry.resetTime) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => {
        this.store.delete(key);
      });
    }, 60 * 1000); // Cleanup every minute
  }

  /**
   * Rate limit middleware
   */
  middleware(configName: string = 'global') {
    return (req: Request, res: Response, next: NextFunction) => {
      const { allowed, remaining, resetTime } = this.checkRateLimit(configName, req);

      res.setHeader('X-RateLimit-Limit', this.configs.get(configName)?.maxRequests || 0);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetTime / 1000));

      if (!allowed) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        });
      }

      next();
    };
  }
}

/**
 * Request validation service
 */
export class RequestValidationService {
  /**
   * Validate request body against schema
   */
  validateBody<T>(schema: z.ZodSchema<T>, body: unknown): { valid: boolean; data?: T; errors?: Record<string, string> } {
    try {
      const data = schema.parse(body);
      return { valid: true, data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach((issue: any) => {
          const path = issue.path.join('.');
          errors[path] = issue.message;
        });
        return { valid: false, errors };
      }
      return { valid: false, errors: { _: 'Validation failed' } };
    }
  }

  /**
   * Validate request query parameters
   */
  validateQuery<T>(schema: z.ZodSchema<T>, query: unknown): { valid: boolean; data?: T; errors?: Record<string, string> } {
    return this.validateBody(schema, query);
  }

  /**
   * Validation middleware factory
   */
  bodyValidator(schema: z.ZodSchema<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = this.validateBody(schema, req.body);

      if (!result.valid) {
        return res.status(400).json({
          error: 'Validation failed',
          details: result.errors,
        });
      }

      (req as any).validatedBody = result.data;
      next();
    };
  }

  /**
   * Query validation middleware factory
   */
  queryValidator(schema: z.ZodSchema<any>) {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = this.validateQuery(schema, req.query);

      if (!result.valid) {
        return res.status(400).json({
          error: 'Query validation failed',
          details: result.errors,
        });
      }

      (req as any).validatedQuery = result.data;
      next();
    };
  }
}

/**
 * API key validation service
 */
export class APIKeyValidationService {
  private apiKeys = new Map<string, { userId: string; tier: 'free' | 'pro' | 'enterprise'; active: boolean }>();

  /**
   * Register API key
   */
  registerAPIKey(key: string, userId: string, tier: 'free' | 'pro' | 'enterprise'): void {
    this.apiKeys.set(key, { userId, tier, active: true });
  }

  /**
   * Validate API key
   */
  validateAPIKey(key: string): APIKeyValidationResult {
    const entry = this.apiKeys.get(key);

    if (!entry || !entry.active) {
      return { valid: false };
    }

    return {
      valid: true,
      userId: entry.userId,
      tier: entry.tier,
    };
  }

  /**
   * API key validation middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const apiKey = req.headers['x-api-key'] as string;

      if (!apiKey) {
        return res.status(401).json({ error: 'API key required' });
      }

      const result = this.validateAPIKey(apiKey);

      if (!result.valid) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      (req as any).userId = result.userId;
      (req as any).tier = result.tier;
      next();
    };
  }
}

/**
 * Abuse detection service
 */
export class AbuseDetectionService {
  private suspiciousPatterns = new Map<string, { count: number; lastSeen: number }>();

  /**
   * Detect abuse patterns
   */
  detectAbuse(req: Request): AbuseDetectionResult {
    let score = 0;
    const reasons: string[] = [];

    // Check for rapid requests from same IP
    const ipKey = `ip:${req.ip}`;
    const ipPattern = this.suspiciousPatterns.get(ipKey);
    const now = Date.now();

    if (ipPattern && now - ipPattern.lastSeen < 1000) {
      score += 10;
      reasons.push('Rapid requests detected');
    }

    // Check for suspicious user agents
    const userAgent = req.headers['user-agent'] || '';
    if (this.isSuspiciousUserAgent(userAgent)) {
      score += 5;
      reasons.push('Suspicious user agent');
    }

    // Check for missing headers
    if (!req.headers['accept'] || !req.headers['accept-language']) {
      score += 3;
      reasons.push('Missing standard headers');
    }

    // Check for SQL injection patterns
    const body = JSON.stringify(req.body || {});
    if (this.containsSQLInjectionPattern(body)) {
      score += 50;
      reasons.push('SQL injection pattern detected');
    }

    // Update pattern tracking
    if (score > 0) {
      this.suspiciousPatterns.set(ipKey, {
        count: (ipPattern?.count || 0) + 1,
        lastSeen: now,
      });
    }

    return {
      isAbuse: score >= 20,
      score,
      reason: reasons.join('; ') || undefined,
    };
  }

  /**
   * Check for suspicious user agent
   */
  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = ['bot', 'crawler', 'scraper', 'curl', 'wget', 'python'];
    return suspiciousPatterns.some(pattern => userAgent.toLowerCase().includes(pattern));
  }

  /**
   * Check for SQL injection patterns
   */
  private containsSQLInjectionPattern(text: string): boolean {
    const sqlPatterns = [
      /(\bUNION\b.*\bSELECT\b)/i,
      /(\bDROP\b.*\bTABLE\b)/i,
      /(\bINSERT\b.*\bINTO\b)/i,
      /(\bDELETE\b.*\bFROM\b)/i,
      /(\bUPDATE\b.*\bSET\b)/i,
      /(\bEXEC\b.*\()/i,
      /(\bEXECUTE\b.*\()/i,
    ];

    return sqlPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Abuse detection middleware
   */
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const result = this.detectAbuse(req);

      if (result.isAbuse) {
        return res.status(403).json({
          error: 'Suspicious activity detected',
          reason: result.reason,
        });
      }

      next();
    };
  }
}

/**
 * Global services
 */
export const rateLimiterService = new RateLimiterService();
export const requestValidationService = new RequestValidationService();
export const apiKeyValidationService = new APIKeyValidationService();
export const abuseDetectionService = new AbuseDetectionService();
