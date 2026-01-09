import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { AuthUser, JwtPayload, RefreshTokenPayload } from '../types/index.js';

// JWT Secret - in production, use a proper secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'datadock-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '1h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';
const SALT_ROUNDS = 12;

/**
 * Cache for Neon SQL functions to reuse connections
 */
const sqlCache = new Map<string, ReturnType<typeof neon>>();

/**
 * Get or create a cached SQL function for a connection string
 */
function getSql(connectionString: string): ReturnType<typeof neon> {
  let sql = sqlCache.get(connectionString);
  if (!sql) {
    sql = neon(connectionString);
    sqlCache.set(connectionString, sql);
  }
  return sql;
}

/**
 * Helper to execute dynamic SQL queries with the Neon driver
 * Includes retry logic and timeout for intermittent connection failures
 */
async function executeQuery(
  connectionString: string,
  query: string,
  params: any[] = [],
  retries: number = 2,
  timeoutMs: number = 8000
): Promise<any[]> {
  const sql = getSql(connectionString);
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Wrap the query in a timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), timeoutMs);
      });
      
      const queryPromise = sql.query(query, params);
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      return result as any[];
    } catch (error) {
      console.error(`Auth query error (attempt ${attempt + 1}/${retries + 1}):`, error);
      
      // If this was the last attempt, throw the error
      if (attempt === retries) {
        sqlCache.delete(connectionString);
        throw error;
      }
      
      // Clear the cached connection and retry with a fresh one
      sqlCache.delete(connectionString);
      
      // Small delay before retry
      await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
    }
  }
  
  throw new Error('Query execution failed after all retries');
}

/**
 * SQL to create the auth_users table
 */
export const CREATE_AUTH_USERS_TABLE = `
  CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_sign_in TIMESTAMP WITH TIME ZONE
  );

  CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
`;

/**
 * SQL to create refresh tokens table
 */
export const CREATE_REFRESH_TOKENS_TABLE = `
  CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked BOOLEAN DEFAULT FALSE
  );

  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON auth_refresh_tokens(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON auth_refresh_tokens(token_hash);
`;

/**
 * Initialize auth tables for a project
 */
export async function initializeAuthTables(connectionString: string): Promise<void> {
  // Split CREATE_AUTH_USERS_TABLE into separate statements
  const userTableStatements = CREATE_AUTH_USERS_TABLE.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of userTableStatements) {
    await executeQuery(connectionString, stmt);
  }
  // Split CREATE_REFRESH_TOKENS_TABLE into separate statements
  const refreshTableStatements = CREATE_REFRESH_TOKENS_TABLE.split(';').map(s => s.trim()).filter(Boolean);
  for (const stmt of refreshTableStatements) {
    await executeQuery(connectionString, stmt);
  }
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate an access token (JWT)
 */
export function generateAccessToken(userId: string, email: string, projectId: string): string {
  const payload = {
    sub: userId,
    email,
    projectId,
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(userId: string, projectId: string): string {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    sub: userId,
    projectId,
    type: 'refresh',
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

/**
 * Verify and decode an access token
 */
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Verify and decode a refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Create a new user
 */
export async function createUser(
  connectionString: string,
  email: string,
  password: string
): Promise<AuthUser> {
  const passwordHash = await hashPassword(password);
  
  const result = await executeQuery(
    connectionString,
    `INSERT INTO auth_users (email, password_hash) 
     VALUES ($1, $2) 
     RETURNING id, email, email_verified, created_at, updated_at, last_sign_in`,
    [email.toLowerCase(), passwordHash]
  );
  
  if (result.length === 0) {
    throw new Error('Failed to create user');
  }
  
  return {
    id: result[0].id,
    email: result[0].email,
    email_verified: result[0].email_verified,
    created_at: result[0].created_at,
    updated_at: result[0].updated_at,
    last_sign_in: result[0].last_sign_in,
  };
}

/**
 * Find user by email
 */
export async function findUserByEmail(
  connectionString: string,
  email: string
): Promise<{ id: string; email: string; password_hash: string; email_verified: boolean; created_at: Date; updated_at: Date; last_sign_in: Date | null } | null> {
  const result = await executeQuery(
    connectionString,
    `SELECT id, email, password_hash, email_verified, created_at, updated_at, last_sign_in 
     FROM auth_users 
     WHERE email = $1`,
    [email.toLowerCase()]
  );
  
  return result[0] || null;
}

/**
 * Find user by ID
 */
export async function findUserById(
  connectionString: string,
  userId: string
): Promise<AuthUser | null> {
  const result = await executeQuery(
    connectionString,
    `SELECT id, email, email_verified, created_at, updated_at, last_sign_in 
     FROM auth_users 
     WHERE id = $1`,
    [userId]
  );
  
  if (result.length === 0) {
    return null;
  }
  
  return {
    id: result[0].id,
    email: result[0].email,
    email_verified: result[0].email_verified,
    created_at: result[0].created_at,
    updated_at: result[0].updated_at,
    last_sign_in: result[0].last_sign_in,
  };
}

/**
 * Update last sign in time
 */
export async function updateLastSignIn(
  connectionString: string,
  userId: string
): Promise<void> {
  await executeQuery(
    connectionString,
    `UPDATE auth_users 
     SET last_sign_in = NOW(), updated_at = NOW() 
     WHERE id = $1`,
    [userId]
  );
}

/**
 * Store refresh token
 */
export async function storeRefreshToken(
  connectionString: string,
  userId: string,
  token: string,
  expiresAt: Date
): Promise<void> {
  const tokenHash = await bcrypt.hash(token, 10);
  
  await executeQuery(
    connectionString,
    `INSERT INTO auth_refresh_tokens (user_id, token_hash, expires_at) 
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt]
  );
}

/**
 * Revoke all refresh tokens for a user
 */
export async function revokeUserRefreshTokens(
  connectionString: string,
  userId: string
): Promise<void> {
  await executeQuery(
    connectionString,
    `UPDATE auth_refresh_tokens 
     SET revoked = TRUE 
     WHERE user_id = $1`,
    [userId]
  );
}

/**
 * Change user password
 */
export async function changePassword(
  connectionString: string,
  userId: string,
  newPassword: string
): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  
  await executeQuery(
    connectionString,
    `UPDATE auth_users 
     SET password_hash = $1, updated_at = NOW() 
     WHERE id = $2`,
    [passwordHash, userId]
  );
  
  // Revoke all existing refresh tokens
  await revokeUserRefreshTokens(connectionString, userId);
}

/**
 * Delete user
 */
export async function deleteUser(
  connectionString: string,
  userId: string
): Promise<boolean> {
  const result = await executeQuery(
    connectionString,
    `DELETE FROM auth_users WHERE id = $1 RETURNING id`,
    [userId]
  );
  
  return result.length > 0;
}

/**
 * Get JWT expiry in seconds
 */
export function getAccessTokenExpirySeconds(): number {
  return 3600; // 1 hour
}

