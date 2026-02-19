import bcrypt from 'bcrypt';
import { db } from '../db';

interface User {
  id: number;
  username: string;
  email: string;
  google_access_token?: string;
  google_refresh_token?: string;
  google_token_expiry?: number;
  roles?: string;
}

interface ListUsersOptions {
  page?: number;
  limit?: number;
  all?: boolean;
  sortBy?: string;
  sortOrder?: string;
}

class UserService {
  private static instance: UserService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Get all users or paginated users with sorting
   */
  public getUsers(options: ListUsersOptions): { total: number; users: User[]; page?: number; limit?: number } {
    const { page = 1, limit = 10, all = false, sortBy = 'username', sortOrder = 'asc' } = options;

    const sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    const validColumns = ['username', 'email', 'id'];

    if (!validColumns.includes(sortByStr)) {
      throw new Error('Invalid sort column.');
    }

    if (!['asc', 'desc'].includes(sortOrderStr)) {
      throw new Error('Invalid sort order.');
    }

    if (all) {
      const users = db
        .prepare(
          `
          SELECT
            u.id,
            u.username,
            u.email,
            u.google_access_token,
            u.google_refresh_token,
            u.google_token_expiry,
            GROUP_CONCAT(r.name) as roles
          FROM users u
          LEFT JOIN user_roles ur ON u.id = ur.user_id
          LEFT JOIN roles r ON ur.role_id = r.id
          GROUP BY u.id
          ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
        `
        )
        .all() as User[];

      return {
        total: users.length,
        users,
      };
    }

    const offset = (page - 1) * limit;

    const totalRow = db
      .prepare('SELECT COUNT(*) AS count FROM users')
      .get() as { count: number };

    const users = db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.email,
          u.google_access_token,
          u.google_refresh_token,
          u.google_token_expiry,
          GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        GROUP BY u.id
        ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}
        LIMIT ? OFFSET ?
      `
      )
      .all(limit, offset) as User[];

    return {
      total: totalRow.count,
      users,
      page,
      limit,
    };
  }

  /**
   * Get a user by ID
   */
  public getUserById(id: number | string): User | undefined {
    return db
      .prepare(
        `
        SELECT
          u.id,
          u.username,
          u.email,
          u.google_access_token,
          u.google_refresh_token,
          u.google_token_expiry,
          GROUP_CONCAT(r.name) as roles
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ?
      `
      )
      .get(id) as User | undefined;
  }

  /**
   * Update a user
   */
  public updateUser(
    id: number | string,
    updates: { username?: string; email?: string; passwordHash?: string }
  ): { success: boolean; changes: number } {
    const { username, email, passwordHash } = updates;

    const result = db.prepare(`
      UPDATE users
      SET
        username = COALESCE(?, username),
        email = COALESCE(?, email),
        password_hash = COALESCE(?, password_hash)
      WHERE id = ?
    `).run(username, email, passwordHash, id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a user
   */
  public deleteUser(id: number | string): { success: boolean; changes: number } {
    const result = db.prepare(`DELETE FROM users WHERE id = ?`).run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Get user password hash
   */
  public getUserPasswordHash(id: number | string): string | undefined {
    const user = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .get(id) as { id: number; password_hash: string } | undefined;

    return user?.password_hash;
  }

  /**
   * Update user password
   */
  public async updateUserPassword(id: number | string, newPassword: string): Promise<void> {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, id);
  }

  /**
   * Verify password
   */
  public async verifyPassword(currentPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(currentPassword, passwordHash);
  }

  /**
   * Get Google access token for a user
   */
  public getGoogleAccessToken(userId: number): string | undefined {
    const row = db
      .prepare('SELECT google_access_token FROM users WHERE id = ?')
      .get(userId) as { google_access_token: string } | undefined;

    return row?.google_access_token;
  }


  /**
   * Assign a role to a user
   */
  public assignRoleToUser(userId: string, roleId: string): { success: boolean } {
    db.prepare(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `
    ).run(userId, roleId);

    return { success: true };
  }

  /**
   * Remove a role from a user
   */
  public removeRoleFromUser(userId: string, roleId: string): { success: boolean } {
    db.prepare(
      `
      DELETE FROM user_roles
      WHERE user_id = ? AND role_id = ?
    `
    ).run(userId, roleId);

    return { success: true };
  }

  /**
   * Change a user's password
   * Verifies current password and updates to new password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean }> {
    // Fetch the user's current password hash
    const user = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as { password_hash: string } | undefined;

    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isMatch) {
      throw new Error('Incorrect current password');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      newPasswordHash,
      userId
    );

    return { success: true };
  }
}

export const userService = UserService.getInstance();



