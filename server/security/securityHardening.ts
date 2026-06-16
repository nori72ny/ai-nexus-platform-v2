import jwt from 'jsonwebtoken';
import * as argon2 from 'argon2';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

/**
 * Security configuration
 */
export interface SecurityConfig {
  jwtSecret: string;
  jwtAccessTokenExpiry: string;
  jwtRefreshTokenExpiry: string;
  csrfTokenLength: number;
  secureCookie: boolean;
  cookieSameSite: 'strict' | 'lax' | 'none';
  cookieSecure: boolean;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSpecialChars: boolean;
}

/**
 * Default security configuration
 */
export const defaultSecurityConfig: SecurityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-in-production',
  jwtAccessTokenExpiry: '15m',
  jwtRefreshTokenExpiry: '7d',
  csrfTokenLength: 32,
  secureCookie: process.env.NODE_ENV === 'production',
  cookieSameSite: 'strict',
  cookieSecure: process.env.NODE_ENV === 'production',
  passwordMinLength: 12,
  passwordRequireUppercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecialChars: true,
};

/**
 * JWT token payload
 */
export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  iat: number;
  exp: number;
}

/**
 * Security hardening service
 */
export class SecurityHardeningService {
  private config: SecurityConfig;
  private csrfTokenStore = new Map<string, { token: string; createdAt: number }>();

  constructor(config: Partial<SecurityConfig> = {}) {
    this.config = { ...defaultSecurityConfig, ...config };
    this.startCSRFTokenCleanup();
  }

  /**
   * Hash password using Argon2
   */
  async hashPassword(password: string): Promise<string> {
    this.validatePassword(password);

    try {
      return await argon2.hash(password, {
        type: argon2.argon2id,
        memoryCost: 65536, // 64 MB
        timeCost: 3,
        parallelism: 4,
        raw: false,
      });
    } catch (error) {
      throw new Error(`Password hashing failed: ${String(error)}`);
    }
  }

  /**
   * Verify password against hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch (error) {
      console.error('Password verification failed:', error);
      return false;
    }
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): void {
    if (password.length < this.config.passwordMinLength) {
      throw new Error(`Password must be at least ${this.config.passwordMinLength} characters`);
    }

    if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }

    if (this.config.passwordRequireNumbers && !/\d/.test(password)) {
      throw new Error('Password must contain at least one number');
    }

    if (this.config.passwordRequireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(payload: Omit<JWTPayload, 'type' | 'iat' | 'exp'>): string {
    const tokenPayload = {
      ...payload,
      type: 'access',
    };

    return jwt.sign(tokenPayload, this.config.jwtSecret, {
      expiresIn: this.config.jwtAccessTokenExpiry,
      algorithm: 'HS256',
    } as any);
  }

  /**
   * Generate JWT refresh token
   */
  generateRefreshToken(payload: Omit<JWTPayload, 'type' | 'iat' | 'exp'>): string {
    const tokenPayload = {
      ...payload,
      type: 'refresh',
    };

    return jwt.sign(tokenPayload, this.config.jwtSecret, {
      expiresIn: this.config.jwtRefreshTokenExpiry,
      algorithm: 'HS256',
    } as any);
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): JWTPayload | null {
    try {
      const payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'],
      }) as JWTPayload;

      return payload;
    } catch (error) {
      console.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Rotate refresh token
   */
  rotateRefreshToken(oldToken: string): { accessToken: string; refreshToken: string } | null {
    const payload = this.verifyToken(oldToken);

    if (!payload || payload.type !== 'refresh') {
      return null;
    }

    const newAccessToken = this.generateAccessToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    const newRefreshToken = this.generateRefreshToken({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * Generate CSRF token
   */
  generateCSRFToken(sessionId: string): string {
    const token = crypto.randomBytes(this.config.csrfTokenLength).toString('hex');

    this.csrfTokenStore.set(sessionId, {
      token,
      createdAt: Date.now(),
    });

    return token;
  }

  /**
   * Verify CSRF token
   */
  verifyCSRFToken(sessionId: string, token: string): boolean {
    const stored = this.csrfTokenStore.get(sessionId);

    if (!stored) {
      return false;
    }

    // Token expires after 1 hour
    if (Date.now() - stored.createdAt > 60 * 60 * 1000) {
      this.csrfTokenStore.delete(sessionId);
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(stored.token));
  }

  /**
   * Start CSRF token cleanup (remove expired tokens)
   */
  private startCSRFTokenCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      const keysToDelete: string[] = [];
      this.csrfTokenStore.forEach((data, sessionId) => {
        if (now - data.createdAt > maxAge) {
          keysToDelete.push(sessionId);
        }
      });

      keysToDelete.forEach(sessionId => {
        this.csrfTokenStore.delete(sessionId);
      });
    }, 15 * 60 * 1000); // Cleanup every 15 minutes
  }

  /**
   * Set secure cookie
   */
  setSecureCookie(res: Response, name: string, value: string, maxAge: number): void {
    res.cookie(name, value, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      maxAge,
      path: '/',
    });
  }

  /**
   * Clear cookie
   */
  clearCookie(res: Response, name: string): void {
    res.clearCookie(name, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: this.config.cookieSameSite,
      path: '/',
    });
  }

  /**
   * Generate Content Security Policy header
   */
  getCSPHeader(): string {
    return [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; ');
  }

  /**
   * CSRF protection middleware
   */
  csrfProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF check for GET, HEAD, OPTIONS
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const sessionId = (req as any).sessionID || req.headers['x-session-id'] as string;
      const csrfToken = req.headers['x-csrf-token'] as string;

      if (!sessionId || !csrfToken) {
        return res.status(403).json({ error: 'CSRF token missing' });
      }

      if (!this.verifyCSRFToken(sessionId, csrfToken)) {
        return res.status(403).json({ error: 'CSRF token invalid' });
      }

      next();
    };
  }

  /**
   * XSS protection middleware
   */
  xssProtectionMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      res.setHeader('Content-Security-Policy', this.getCSPHeader());
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

      next();
    };
  }

  /**
   * HSTS middleware
   */
  hstsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      if (this.config.cookieSecure) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      next();
    };
  }
}

/**
 * Global security service instance
 */
export const securityService = new SecurityHardeningService(defaultSecurityConfig);
