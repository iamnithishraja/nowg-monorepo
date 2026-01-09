import { Hono } from 'hono';
import { Project } from '../db/models/index.js';
import {
  createUser,
  findUserByEmail,
  findUserById,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  updateLastSignIn,
  storeRefreshToken,
  revokeUserRefreshTokens,
  changePassword,
  deleteUser,
  getAccessTokenExpirySeconds,
} from '../services/auth.js';
import type { SignUpRequest, SignInRequest, AuthResponse } from '../types/index.js';

const auth = new Hono();

/**
 * Middleware to extract and validate API key using Mongoose
 */
async function extractProject(c: any) {
  const apiKey = c.req.header('x-api-key') || c.req.query('apiKey');
  
  if (!apiKey) {
    return null;
  }

  return Project.findOne({ apiKey }).lean();
}

/**
 * Middleware to extract and validate JWT token
 */
function extractBearerToken(c: any): string | null {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  return authHeader.slice(7);
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate password strength
 */
function isValidPassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' };
  }
  return { valid: true };
}

/**
 * POST /api/v1/:projectId/auth/signup
 * Register a new user
 */
auth.post('/:projectId/auth/signup', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const body = await c.req.json<SignUpRequest>();
    
    // Validate email
    if (!body.email || !isValidEmail(body.email)) {
      return c.json({ 
        success: false, 
        error: 'Valid email is required' 
      }, 400);
    }

    // Validate password
    if (!body.password) {
      return c.json({ 
        success: false, 
        error: 'Password is required' 
      }, 400);
    }

    const passwordValidation = isValidPassword(body.password);
    if (!passwordValidation.valid) {
      return c.json({ 
        success: false, 
        error: passwordValidation.error 
      }, 400);
    }

    // Check if user already exists
    const existingUser = await findUserByEmail(projectByKey.neonConnectionString, body.email);
    if (existingUser) {
      return c.json({ 
        success: false, 
        error: 'User with this email already exists' 
      }, 409);
    }

    // Create user
    const user = await createUser(
      projectByKey.neonConnectionString,
      body.email,
      body.password
    );

    // Generate tokens
    const accessToken = generateAccessToken(user.id, user.email, projectId);
    const refreshToken = generateRefreshToken(user.id, projectId);
    
    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await storeRefreshToken(projectByKey.neonConnectionString, user.id, refreshToken, refreshExpiry);

    const response: AuthResponse = {
      success: true,
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: getAccessTokenExpirySeconds(),
    };

    return c.json(response, 201);
  } catch (error) {
    console.error('Signup error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to create user'
    }, 500);
  }
});

/**
 * POST /api/v1/:projectId/auth/login
 * Login with email and password
 */
auth.post('/:projectId/auth/login', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const body = await c.req.json<SignInRequest>();
    
    if (!body.email || !body.password) {
      return c.json({ 
        success: false, 
        error: 'Email and password are required' 
      }, 400);
    }

    // Find user
    const userRecord = await findUserByEmail(projectByKey.neonConnectionString, body.email);
    if (!userRecord) {
      return c.json({ 
        success: false, 
        error: 'Invalid email or password' 
      }, 401);
    }

    // Verify password
    const isValidPassword = await verifyPassword(body.password, userRecord.password_hash);
    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Invalid email or password' 
      }, 401);
    }

    // Update last sign in
    await updateLastSignIn(projectByKey.neonConnectionString, userRecord.id);

    // Generate tokens
    const accessToken = generateAccessToken(userRecord.id, userRecord.email, projectId);
    const refreshToken = generateRefreshToken(userRecord.id, projectId);
    
    // Store refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storeRefreshToken(projectByKey.neonConnectionString, userRecord.id, refreshToken, refreshExpiry);

    const user = {
      id: userRecord.id,
      email: userRecord.email,
      email_verified: userRecord.email_verified,
      created_at: userRecord.created_at,
      updated_at: userRecord.updated_at,
      last_sign_in: new Date(),
    };

    const response: AuthResponse = {
      success: true,
      user,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: getAccessTokenExpirySeconds(),
    };

    return c.json(response);
  } catch (error) {
    console.error('Login error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Login failed'
    }, 500);
  }
});

/**
 * GET /api/v1/:projectId/auth/me
 * Get current authenticated user
 */
auth.get('/:projectId/auth/me', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    // Extract and verify JWT
    const token = extractBearerToken(c);
    if (!token) {
      return c.json({ 
        success: false, 
        error: 'Authorization token required. Use Bearer token in Authorization header.' 
      }, 401);
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return c.json({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 401);
    }

    // Verify token belongs to this project
    if (payload.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'Token does not belong to this project' 
      }, 403);
    }

    // Get user from database
    const user = await findUserById(projectByKey.neonConnectionString, payload.sub);
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    return c.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error('Get me error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to get user'
    }, 500);
  }
});

/**
 * POST /api/v1/:projectId/auth/refresh
 * Refresh access token using refresh token
 */
auth.post('/:projectId/auth/refresh', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    const { refresh_token } = await c.req.json<{ refresh_token: string }>();
    
    if (!refresh_token) {
      return c.json({ 
        success: false, 
        error: 'Refresh token is required' 
      }, 400);
    }

    // Verify refresh token
    const payload = verifyRefreshToken(refresh_token);
    if (!payload) {
      return c.json({ 
        success: false, 
        error: 'Invalid or expired refresh token' 
      }, 401);
    }

    // Verify token belongs to this project
    if (payload.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'Token does not belong to this project' 
      }, 403);
    }

    // Get user
    const user = await findUserById(projectByKey.neonConnectionString, payload.sub);
    if (!user) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    // Generate new tokens
    const accessToken = generateAccessToken(user.id, user.email, projectId);
    const newRefreshToken = generateRefreshToken(user.id, projectId);
    
    // Store new refresh token
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await storeRefreshToken(projectByKey.neonConnectionString, user.id, newRefreshToken, refreshExpiry);

    const response: AuthResponse = {
      success: true,
      user,
      access_token: accessToken,
      refresh_token: newRefreshToken,
      expires_in: getAccessTokenExpirySeconds(),
    };

    return c.json(response);
  } catch (error) {
    console.error('Refresh token error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to refresh token'
    }, 500);
  }
});

/**
 * POST /api/v1/:projectId/auth/logout
 * Logout and revoke refresh tokens
 */
auth.post('/:projectId/auth/logout', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    // Extract and verify JWT
    const token = extractBearerToken(c);
    if (!token) {
      return c.json({ 
        success: false, 
        error: 'Authorization token required' 
      }, 401);
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return c.json({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 401);
    }

    // Revoke all refresh tokens for this user
    await revokeUserRefreshTokens(projectByKey.neonConnectionString, payload.sub);

    return c.json({
      success: true,
      message: 'Successfully logged out',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Logout failed'
    }, 500);
  }
});

/**
 * PUT /api/v1/:projectId/auth/password
 * Change password for authenticated user
 */
auth.put('/:projectId/auth/password', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    // Extract and verify JWT
    const token = extractBearerToken(c);
    if (!token) {
      return c.json({ 
        success: false, 
        error: 'Authorization token required' 
      }, 401);
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return c.json({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 401);
    }

    const { current_password, new_password } = await c.req.json<{
      current_password: string;
      new_password: string;
    }>();

    if (!current_password || !new_password) {
      return c.json({ 
        success: false, 
        error: 'Current password and new password are required' 
      }, 400);
    }

    // Validate new password
    const passwordValidation = isValidPassword(new_password);
    if (!passwordValidation.valid) {
      return c.json({ 
        success: false, 
        error: passwordValidation.error 
      }, 400);
    }

    // Verify current password
    const userRecord = await findUserByEmail(projectByKey.neonConnectionString, payload.email);
    if (!userRecord) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    const isValid = await verifyPassword(current_password, userRecord.password_hash);
    if (!isValid) {
      return c.json({ 
        success: false, 
        error: 'Current password is incorrect' 
      }, 401);
    }

    // Change password
    await changePassword(projectByKey.neonConnectionString, payload.sub, new_password);

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to change password'
    }, 500);
  }
});

/**
 * DELETE /api/v1/:projectId/auth/user
 * Delete authenticated user's account
 */
auth.delete('/:projectId/auth/user', async (c) => {
  try {
    const projectId = c.req.param('projectId');
    const projectByKey = await extractProject(c);
    
    if (!projectByKey) {
      return c.json({ 
        success: false, 
        error: 'Unauthorized. Provide a valid API key via x-api-key header.' 
      }, 401);
    }

    if (projectByKey.projectId !== projectId) {
      return c.json({ 
        success: false, 
        error: 'API key does not match the requested project.' 
      }, 403);
    }

    // Extract and verify JWT
    const token = extractBearerToken(c);
    if (!token) {
      return c.json({ 
        success: false, 
        error: 'Authorization token required' 
      }, 401);
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return c.json({ 
        success: false, 
        error: 'Invalid or expired token' 
      }, 401);
    }

    // Delete user
    const deleted = await deleteUser(projectByKey.neonConnectionString, payload.sub);
    
    if (!deleted) {
      return c.json({ 
        success: false, 
        error: 'User not found' 
      }, 404);
    }

    return c.json({
      success: true,
      message: 'User account deleted successfully',
    });
  } catch (error) {
    console.error('Delete user error:', error);
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to delete user'
    }, 500);
  }
});

export default auth;

