import { Request, Response, NextFunction } from 'express';
import { securityService } from './securityHardening';
import { tokenBlacklistService } from './tokenBlacklist';
import { logAudit } from '../auditLog';

/**
 * Enhanced security service with Redis integration
 */
export class EnhancedSecurityService {
  /**
   * Verify token and check blacklist
   */
  async verifyTokenWithBlacklist(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    // First verify token signature
    const payload = securityService.verifyToken(token);

    if (!payload) {
      return { valid: false, error: 'Invalid token signature' };
    }

    // Check if token is blacklisted
    const isBlacklisted = await tokenBlacklistService.isBlacklisted(token);

    if (isBlacklisted) {
      return { valid: false, error: 'Token has been revoked' };
    }

    return { valid: true, payload };
  }

  /**
   * Logout user and blacklist token
   */
  async logout(token: string, expiresIn: number): Promise<void> {
    try {
      // Add token to blacklist
      await tokenBlacklistService.addToBlacklist(token, expiresIn);

      console.log('[EnhancedSecurity] User logged out, token blacklisted');
    } catch (error) {
      console.error('[EnhancedSecurity] Logout failed:', error);
      throw error;
    }
  }

  /**
   * Refresh token with rotation
   */
  async refreshTokenWithRotation(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string } | null> {
    try {
      // Check if old token is blacklisted
      const isBlacklisted = await tokenBlacklistService.isBlacklisted(oldRefreshToken);

      if (isBlacklisted) {
        console.warn('[EnhancedSecurity] Attempt to use blacklisted refresh token');
        return null;
      }

      // Rotate token
      const newTokens = securityService.rotateRefreshToken(oldRefreshToken);

      if (!newTokens) {
        return null;
      }

      // Blacklist old token immediately
      await tokenBlacklistService.addToBlacklist(oldRefreshToken, 60); // Blacklist for 1 minute

      return newTokens;
    } catch (error) {
      console.error('[EnhancedSecurity] Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Authentication middleware with token verification and blacklist check
   */
  authMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Extract token from Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'Missing or invalid authorization header' });
        }

        const token = authHeader.substring(7);

        // Verify token and check blacklist
        const result = await this.verifyTokenWithBlacklist(token);

        if (!result.valid) {
          // Log failed authentication
          await logAudit(null as any, {
            action: 'AUTH_FAILED',
            resourceType: 'auth',
            resourceId: 'token_verification',
            details: {
              reason: result.error,
              ip: req.ip,
            },
          });

          return res.status(401).json({ error: result.error });
        }

        // Attach user info to request
        (req as any).user = result.payload;
        (req as any).token = token;

        next();
      } catch (error) {
        console.error('[EnhancedSecurity] Auth middleware error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  /**
   * Logout endpoint handler
   */
  async handleLogout(req: Request, res: Response): Promise<void> {
    try {
      const token = (req as any).token;

      if (!token) {
        res.status(400).json({ error: 'No token found' });
        return;
      }

      // Get token expiry
      const payload = securityService.verifyToken(token);

      if (!payload || !payload.exp) {
        res.status(400).json({ error: 'Invalid token' });
        return;
      }

      const expiresIn = payload.exp - Math.floor(Date.now() / 1000);

      // Logout and blacklist token
      await this.logout(token, expiresIn);

      // Log logout event
      await logAudit(null as any, {
        action: 'LOGOUT',
        resourceType: 'auth',
        resourceId: payload.userId,
        details: {
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        },
      });

      // Clear secure cookie
      securityService.clearCookie(res, 'refreshToken');

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('[EnhancedSecurity] Logout handler error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * Refresh token endpoint handler
   */
  async handleRefreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required' });
        return;
      }

      // Refresh with rotation
      const newTokens = await this.refreshTokenWithRotation(refreshToken);

      if (!newTokens) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
        return;
      }

      // Set new refresh token in secure cookie
      securityService.setSecureCookie(res, 'refreshToken', newTokens.refreshToken, 7 * 24 * 60 * 60 * 1000);

      // Log token refresh
      const payload = securityService.verifyToken(newTokens.accessToken);
      await logAudit(null as any, {
        action: 'TOKEN_REFRESHED',
        resourceType: 'auth',
        resourceId: payload?.userId || 'unknown',
        details: {
          ip: req.ip,
        },
      });

      res.json({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
      });
    } catch (error) {
      console.error('[EnhancedSecurity] Refresh token handler error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  /**
   * Session validation middleware
   */
  sessionValidationMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;

        if (!user) {
          return res.status(401).json({ error: 'User not authenticated' });
        }

        // Check if user session is still valid
        // In production, you might check against a session store
        const now = Math.floor(Date.now() / 1000);

        if (user.exp && now > user.exp) {
          return res.status(401).json({ error: 'Token expired' });
        }

        next();
      } catch (error) {
        console.error('[EnhancedSecurity] Session validation error:', error);
        res.status(500).json({ error: 'Session validation failed' });
      }
    };
  }

  /**
   * Get security status
   */
  async getSecurityStatus(): Promise<{
    tokenBlacklistSize: number;
    redisConnected: boolean;
  }> {
    try {
      const blacklistSize = await tokenBlacklistService.getBlacklistSize();

      return {
        tokenBlacklistSize: blacklistSize,
        redisConnected: true,
      };
    } catch (error) {
      console.error('[EnhancedSecurity] Failed to get security status:', error);

      return {
        tokenBlacklistSize: 0,
        redisConnected: false,
      };
    }
  }
}

/**
 * Global enhanced security service instance
 */
export const enhancedSecurityService = new EnhancedSecurityService();
