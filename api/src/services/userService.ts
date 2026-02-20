import bcrypt from 'bcrypt';
import { db } from '../db';

interface User {
  id: number; username: string; email: string;
  google_access_token?: string; google_refresh_token?: string; google_token_expiry?: number;
  roles?: string;
}

interface ListUsersOptions {
  page?: number; limit?: number; all?: boolean; sortBy?: string; sortOrder?: string;
}

class UserService {
  private static instance: UserService;
  private constructor() {}
  public static getInstance(): UserService {
    if (!UserService.instance) { UserService.instance = new UserService(); }
    return UserService.instance;
  }

  /**
   * Get all users or paginated users with sorting
   */
  public async getUsers(options: ListUsersOptions): Promise<{ total: number; users: User[]; page?: number; limit?: number }> {
    const { page = 1, limit = 10, all = false, sortBy = 'username', sortOrder = 'asc' } = options;
    const sortByStr = sortBy.toString();
    const sortOrderStr = sortOrder.toString().toLowerCase();
    const validColumns = ['username', 'email', 'id'];
    if (!validColumns.includes(sortByStr)) throw new Error('Invalid sort column.');
    if (!['asc', 'desc'].includes(sortOrderStr)) throw new Error('Invalid sort order.');

    const baseSelect = `
      SELECT u.id, u.username, u.email, u.google_access_token, u.google_refresh_token, u.google_token_expiry,
             STRING_AGG(r.name, ',') as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      GROUP BY u.id`;

    if (all) {
      const users = await db.all<User>(`${baseSelect} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()}`);
      return { total: users.length, users };
    }

    const offset = (page - 1) * limit;
    const totalRow = await db.get<{ count: string }>('SELECT COUNT(*) AS count FROM users');
    const users = await db.all<User>(
      `${baseSelect} ORDER BY ${sortByStr} ${sortOrderStr.toUpperCase()} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { total: Number(totalRow?.count ?? 0), users, page, limit };
  }

  /**
   * Get a user by ID
   */
  public async getUserById(id: number | string): Promise<User | undefined> {
    return db.get<User>(
      `SELECT u.id, u.username, u.email, u.google_access_token, u.google_refresh_token, u.google_token_expiry,
              STRING_AGG(r.name, ',') as roles
       FROM users u
       LEFT JOIN user_roles ur ON u.id = ur.user_id
       LEFT JOIN roles r ON ur.role_id = r.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );
  }

  /**
   * Update a user
   */
  public async updateUser(id: number | string, updates: { username?: string; email?: string; passwordHash?: string }): Promise<{ success: boolean; changes: number }> {
    const { username, email, passwordHash } = updates;
    const result = await db.run(
      `UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), password_hash = COALESCE($3, password_hash) WHERE id = $4`,
      [username, email, passwordHash, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Delete a user
   */
  public async deleteUser(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM users WHERE id = $1', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Get user password hash
   */
  public async getUserPasswordHash(id: number | string): Promise<string | undefined> {
    const user = await db.get<{ id: number; password_hash: string }>('SELECT id, password_hash FROM users WHERE id = $1', [id]);
    return user?.password_hash;
  }

  /**
   * Update user password
   */
  public async updateUserPassword(id: number | string, newPassword: string): Promise<void> {
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, id]);
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
  public async getGoogleAccessToken(userId: number): Promise<string | undefined> {
    const row = await db.get<{ google_access_token: string }>('SELECT google_access_token FROM users WHERE id = $1', [userId]);
    return row?.google_access_token;
  }


  /**
   * Assign a role to a user
   */
  public async assignRoleToUser(userId: string, roleId: string): Promise<{ success: boolean }> {
    await db.run('INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)', [userId, roleId]);
    return { success: true };
  }

  /**
   * Remove a role from a user
   */
  public async removeRoleFromUser(userId: string, roleId: string): Promise<{ success: boolean }> {
    await db.run('DELETE FROM user_roles WHERE user_id = $1 AND role_id = $2', [userId, roleId]);
    return { success: true };
  }

  /**
   * Change a user's password
   * Verifies current password and updates to new password
   */
  public async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const user = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (!user) throw new Error('User not found');
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) throw new Error('Incorrect current password');
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await db.run('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, userId]);
    return { success: true };
  }
}

export const userService = UserService.getInstance();

