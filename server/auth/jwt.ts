import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getDb } from '../db';
import { jwtTokens, userSessions } from '../../drizzle/schema';

import { eq, and, lt, desc } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key-change-in-production';

export interface JWTPayload {
  sub: string; // User ID
  email: string;
  role: 'admin' | 'user' | 'viewer';
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
  sessionId: string;
}

/**
 * Generate access token (15 minutes)
 */
export async function generateAccessToken(
  userId: number,
  email: string,
  role: 'admin' | 'user' | 'viewer',
  sessionId: string
): Promise<string> {
  const payload: JWTPayload = {
    sub: String(userId),
    email,
    role,
    type: 'access',
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };

  const token = jwt.sign(payload, JWT_SECRET);
  
  // Store token hash in database for revocation tracking
  const tokenHash = hashToken(token);
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.insert(jwtTokens).values({
    userId,
    tokenHash,
    tokenType: 'access',
    expiresAt: new Date(payload.exp * 1000),
  });

  return token;
}

/**
 * Generate refresh token (7 days)
 */
export async function generateRefreshToken(
  userId: number,
  email: string,
  role: 'admin' | 'user' | 'viewer',
  sessionId: string
): Promise<string> {
  const payload: JWTPayload = {
    sub: String(userId),
    email,
    role,
    type: 'refresh',
    sessionId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };

  const token = jwt.sign(payload, JWT_REFRESH_SECRET);

  // Store token hash in database
  const tokenHash = hashToken(token);
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.insert(jwtTokens).values({
    userId,
    tokenHash,
    tokenType: 'refresh',
    expiresAt: new Date(payload.exp * 1000),
  });

  return token;
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<JWTPayload | null> {
  try {
    // Validate token format
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      console.warn('[JWT] Invalid token format');
      return null;
    }

    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;

    // Validate payload structure
    if (!payload.sub || !payload.email || !payload.sessionId) {
      console.warn('[JWT] Invalid token payload');
      return null;
    }

    // Check if token is revoked
    const tokenHash = hashToken(token);
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const tokenRecords = await db.select().from(jwtTokens).where(
      and(
        eq(jwtTokens.tokenHash, tokenHash),
        eq(jwtTokens.tokenType, 'access')
      )
    ).limit(1);
    const tokenRecord = tokenRecords.length > 0 ? tokenRecords[0] : null;

    if (!tokenRecord || tokenRecord.revokedAt) {
      console.warn('[JWT] Token revoked or not found');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[JWT] Token verification error:', error);
    return null;
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<JWTPayload | null> {
  try {
    // Validate token format
    if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
      console.warn('[JWT] Invalid refresh token format');
      return null;
    }

    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as JWTPayload;

    // Validate payload structure
    if (!payload.sub || !payload.email || !payload.sessionId) {
      console.warn('[JWT] Invalid refresh token payload');
      return null;
    }

    // Check if token is revoked
    const tokenHash = hashToken(token);
    const db = await getDb();
    if (!db) throw new Error('Database not available');
    
    const tokenRecords = await db.select().from(jwtTokens).where(
      and(
        eq(jwtTokens.tokenHash, tokenHash),
        eq(jwtTokens.tokenType, 'refresh')
      )
    ).limit(1);
    const tokenRecord = tokenRecords.length > 0 ? tokenRecords[0] : null;

    if (!tokenRecord || tokenRecord.revokedAt) {
      console.warn('[JWT] Refresh token revoked or not found');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[JWT] Refresh token verification error:', error);
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload) {
    return null;
  }

  const userId = parseInt(payload.sub);
  const newAccessToken = await generateAccessToken(
    userId,
    payload.email,
    payload.role,
    payload.sessionId
  );

  // Generate new refresh token
  const newRefreshToken = await generateRefreshToken(
    userId,
    payload.email,
    payload.role,
    payload.sessionId
  );

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Revoke token
 */
export async function revokeToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(jwtTokens)
    .set({ revokedAt: new Date() })
    .where(eq(jwtTokens.tokenHash, tokenHash));
}

/**
 * Create user session
 */
export async function createSession(
  userId: number,
  tokenId: number,
  ipAddress: string,
  userAgent: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  const result = await db.insert(userSessions).values({
    userId,
    tokenId,
    ipAddress,
    userAgent,
  });

  return result[0].insertId || 0;
}

/**
 * Update session activity
 */
export async function updateSessionActivity(sessionId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.update(userSessions)
    .set({ lastActivity: new Date() })
    .where(eq(userSessions.id, sessionId));
}

/**
 * Get user sessions
 */
export async function getUserSessions(userId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  return await db.select().from(userSessions)
    .where(eq(userSessions.userId, userId))
    .orderBy(desc(userSessions.lastActivity));
}

/**
 * Revoke all user sessions
 */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  const sessions = await getUserSessions(userId);
  const db = await getDb();
  if (!db) throw new Error('Database not available');

  for (const session of sessions) {
    await db.update(jwtTokens)
      .set({ revokedAt: new Date() })
      .where(eq(jwtTokens.id, session.tokenId));
  }
}

/**
 * Clean up expired tokens
 */
export async function cleanupExpiredTokens(): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  
  await db.delete(jwtTokens)
    .where(lt(jwtTokens.expiresAt, new Date()));
}

/**
 * Hash token for storage
 */
function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch (error) {
    return null;
  }
}
