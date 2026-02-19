import jwt from 'jsonwebtoken';
import { db } from '../db';
import { verifyUser } from '../utils/verifyUser';
import { Role } from '@shared/types';

const JWT_SECRET = process.env.JWT_SECRET;

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  message: string;
  token: string;
}

class SessionService {
  private static instance: SessionService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Check if session is valid by verifying JWT signature
   */
  public isSessionValid(token: string): {
    valid: boolean;
    error?: string;
    decoded?: unknown;
  } {
    if (!JWT_SECRET) {
      return { valid: false, error: 'JWT_SECRET is not set' };
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, decoded };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { valid: false, error: error.message };
      }
      return { valid: false, error: 'Unknown error' };
    }
  }

  /**
   * Verify if a token exists in the database
   */
  public verifyTokenExists(token: string): boolean {
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM user_tokens WHERE token = ?')
      .get(token) as { count: number };

    return row && row.count > 0;
  }

  /**
   * Authenticate user and generate JWT token
   */
  public async login(request: LoginRequest): Promise<LoginResponse> {
    const { username, password } = request;

    if (!username || !password) {
      throw new Error('Username and password are required');
    }

    const { user, error } = await verifyUser(username, password);

    if (error) {
      const errorMsg = error === 'Internal Server Error' ? 'Internal Server Error' : 'Invalid credentials';
      throw new Error(errorMsg);
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Fetch roles for the user
    const roles = (db
      .prepare(
        `SELECT roles.name
         FROM roles
         INNER JOIN user_roles ON roles.id = user_roles.role_id
         WHERE user_roles.user_id = ?`
      )
      .all(user.id) as Role[])
      .map((role: { name: string }) => role.name);

    if (!JWT_SECRET) {
      throw new Error('Server configuration error: JWT_SECRET not set');
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
    };

    // Generate JWT (no expiration, same as original)
    const token = jwt.sign(payload, JWT_SECRET);

    // Store token in database
    db.prepare(`INSERT INTO user_tokens (user_id, token) VALUES (?, ?)`).run(
      user.id,
      token
    );

    return {
      message: 'Login successful',
      token,
    };
  }

  /**
   * Logout user by revoking token
   */
  public logout(token: string): { success: boolean } {
    if (!token) {
      throw new Error('Token missing');
    }

    const result = db
      .prepare(`DELETE FROM user_tokens WHERE token = ?`)
      .run(token);

    if (result.changes === 0) {
      throw new Error('Invalid or already logged out');
    }

    return { success: true };
  }
}

export const sessionService = SessionService.getInstance();

// Export the function for backward compatibility
export function isSessionValid(token: string) {
  return sessionService.isSessionValid(token);
}

