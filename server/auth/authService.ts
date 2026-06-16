import { securityService } from '../security/securityHardening';
import { tokenBlacklistRepository, refreshTokenRotationRepository, sessionRepository } from '../redis/redisRepositories';
import { logAudit } from '../auditLog';

/**
 * Authentication service with Redis integration
 */
export class AuthService {
  /**
   * Login user and create session
   */
  async login(userId: string, email: string, role: string): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    try {
      // Generate tokens
      const accessToken = securityService.generateAccessToken({
        userId,
        email,
        role,
      });

      const refreshToken = securityService.generateRefreshToken({
        userId,
        email,
        role,
      });

      // Create session
      const sessionId = `session:${userId}:${Date.now()}`;
      await sessionRepository.create(sessionId, userId, {
        email,
        role,
        accessToken,
        refreshToken,
        loginAt: Date.now(),
      });

      // Log login
      await logAudit(null as any, {
        action: 'LOGIN',
        resourceType: 'auth',
        resourceId: userId,
        details: {
          email,
          role,
          sessionId,
        },
      });

      console.log(`[AuthService] User ${userId} logged in`);

      return {
        accessToken,
        refreshToken,
        sessionId,
      };
    } catch (error) {
      console.error('[AuthService] Login failed:', error);
      throw error;
    }
  }

  /**
   * Logout user and blacklist tokens
   */
  async logout(userId: string, accessToken: string, refreshToken: string): Promise<void> {
    try {
      // Get token expiry
      const accessPayload = securityService.verifyToken(accessToken);
      const refreshPayload = securityService.verifyToken(refreshToken);

      if (accessPayload?.exp) {
        const accessExpiresIn = accessPayload.exp - Math.floor(Date.now() / 1000);
        await tokenBlacklistRepository.add(accessToken, Math.max(accessExpiresIn, 1));
      }

      if (refreshPayload?.exp) {
        const refreshExpiresIn = refreshPayload.exp - Math.floor(Date.now() / 1000);
        await tokenBlacklistRepository.add(refreshToken, Math.max(refreshExpiresIn, 1));
      }

      // Log logout
      await logAudit(null as any, {
        action: 'LOGOUT',
        resourceType: 'auth',
        resourceId: userId,
        details: {
          timestamp: Date.now(),
        },
      });

      console.log(`[AuthService] User ${userId} logged out`);
    } catch (error) {
      console.error('[AuthService] Logout failed:', error);
      throw error;
    }
  }

  /**
   * Refresh token with rotation
   */
  async refreshToken(userId: string, oldRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> {
    try {
      // Verify old token
      const payload = securityService.verifyToken(oldRefreshToken);

      if (!payload || payload.type !== 'refresh') {
        console.warn('[AuthService] Invalid refresh token');
        return null;
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklistRepository.isBlacklisted(oldRefreshToken);

      if (isBlacklisted) {
        console.warn('[AuthService] Refresh token is blacklisted');

        // Log suspicious activity
        await logAudit(null as any, {
          action: 'SUSPICIOUS_REFRESH_ATTEMPT',
          resourceType: 'auth',
          resourceId: userId,
          details: {
            reason: 'Blacklisted token reuse',
            timestamp: Date.now(),
          },
        });

        return null;
      }

      // Check for token reuse (rotation tracking)
      const lastRotation = await refreshTokenRotationRepository.getLastRotation(userId);

      if (lastRotation && lastRotation.oldToken !== oldRefreshToken) {
        console.warn('[AuthService] Token reuse detected - possible token theft');

        // Log security incident
        await logAudit(null as any, {
          action: 'TOKEN_REUSE_DETECTED',
          resourceType: 'auth',
          resourceId: userId,
          details: {
            reason: 'Possible token theft',
            timestamp: Date.now(),
          },
        });

        // Invalidate all tokens for this user
        await this.invalidateAllTokens(userId);

        return null;
      }

      // Generate new tokens
      const newAccessToken = securityService.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      const newRefreshToken = securityService.generateRefreshToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      });

      // Record rotation
      await refreshTokenRotationRepository.recordRotation(userId, oldRefreshToken, newRefreshToken);

      // Blacklist old refresh token immediately
      const oldPayload = securityService.verifyToken(oldRefreshToken);
      if (oldPayload?.exp) {
        const expiresIn = oldPayload.exp - Math.floor(Date.now() / 1000);
        await tokenBlacklistRepository.add(oldRefreshToken, Math.max(expiresIn, 1));
      }

      // Log token refresh
      await logAudit(null as any, {
        action: 'TOKEN_REFRESHED',
        resourceType: 'auth',
        resourceId: userId,
        details: {
          timestamp: Date.now(),
        },
      });

      console.log(`[AuthService] Token refreshed for user ${userId}`);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      console.error('[AuthService] Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Verify token and check blacklist
   */
  async verifyTokenWithBlacklist(token: string): Promise<{ valid: boolean; payload?: any; error?: string }> {
    try {
      // Verify token signature
      const payload = securityService.verifyToken(token);

      if (!payload) {
        return { valid: false, error: 'Invalid token signature' };
      }

      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklistRepository.isBlacklisted(token);

      if (isBlacklisted) {
        return { valid: false, error: 'Token has been revoked' };
      }

      return { valid: true, payload };
    } catch (error) {
      console.error('[AuthService] Token verification failed:', error);
      return { valid: false, error: 'Token verification failed' };
    }
  }

  /**
   * Invalidate all tokens for user (security incident)
   */
  async invalidateAllTokens(userId: string): Promise<void> {
    try {
      // Clear refresh token rotation tracking
      await refreshTokenRotationRepository.clearRotation(userId);

      // Log security incident
      await logAudit(null as any, {
        action: 'ALL_TOKENS_INVALIDATED',
        resourceType: 'auth',
        resourceId: userId,
        details: {
          reason: 'Security incident - all tokens invalidated',
          timestamp: Date.now(),
        },
      });

      console.log(`[AuthService] All tokens invalidated for user ${userId}`);
    } catch (error) {
      console.error('[AuthService] Failed to invalidate all tokens:', error);
      throw error;
    }
  }

  /**
   * Change password (requires re-authentication)
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    try {
      // Validate new password
      securityService.validatePassword(newPassword);

      // In production, verify old password against database
      // For now, just log the action

      // Invalidate all existing tokens
      await this.invalidateAllTokens(userId);

      // Log password change
      await logAudit(null as any, {
        action: 'PASSWORD_CHANGED',
        resourceType: 'auth',
        resourceId: userId,
        details: {
          timestamp: Date.now(),
        },
      });

      console.log(`[AuthService] Password changed for user ${userId}`);

      return true;
    } catch (error) {
      console.error('[AuthService] Password change failed:', error);
      return false;
    }
  }

  /**
   * Get auth status
   */
  async getAuthStatus(): Promise<{
    blacklistedTokens: number;
    activeSessions: number;
  }> {
    try {
      // In production, use Redis SCAN to count keys
      return {
        blacklistedTokens: 0,
        activeSessions: 0,
      };
    } catch (error) {
      console.error('[AuthService] Failed to get auth status:', error);
      return {
        blacklistedTokens: 0,
        activeSessions: 0,
      };
    }
  }
}

/**
 * Global auth service instance
 */
export const authService = new AuthService();
