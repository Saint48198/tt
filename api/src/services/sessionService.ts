import jwt from 'jsonwebtoken';
import { db } from '../db';
import { verifyUser } from '../utils/verifyUser';
import { Role } from '@shared/types';

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

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
  public async verifyTokenExists(token: string): Promise<boolean> {
    const row = await db.get<{ count: string }>(
      'SELECT COUNT(*) AS count FROM user_tokens WHERE token = $1',
      [token]
    );
    return row ? Number(row.count) > 0 : false;
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
      throw new Error(
        error === 'Internal Server Error' ? 'Internal Server Error' : 'Invalid credentials'
      );
    }

    if (!user) {
      throw new Error('Invalid credentials');
    }

    const roles = (
      await db.all<Role>(
        `SELECT roles.name
         FROM roles
         INNER JOIN user_roles ON roles.id = user_roles.role_id
         WHERE user_roles.user_id = $1`,
        [user.id]
      )
    ).map((role: { name: string }) => role.name);

    if (!JWT_SECRET) {
      throw new Error('Server configuration error: JWT_SECRET not set');
    }

    const payload = { id: user.id, username: user.username, email: user.email, roles };
    const token = jwt.sign(payload, JWT_SECRET);

    await db.run('INSERT INTO user_tokens (user_id, token) VALUES ($1, $2)', [user.id, token]);

    return { message: 'Login successful', token };
  }

  /**
   * Logout user by revoking token
   */
  public async logout(token: string): Promise<{ success: boolean }> {
    if (!token) {
      throw new Error('Token missing');
    }
    const result = await db.run('DELETE FROM user_tokens WHERE token = $1', [token]);
    if (result.rowCount === 0) {
      throw new Error('Invalid or already logged out');
    }
    return { success: true };
  }
}

export const sessionService = SessionService.getInstance();

export function isSessionValid(token: string) {
  return sessionService.isSessionValid(token);
}
