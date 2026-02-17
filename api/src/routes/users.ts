// api/src/routes/users.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { handleApiError } from '../utils/errorHandler';

const router = Router();

// GET /api/users - List all users with pagination and sorting
router.get('/api/users', (req: Request, res: Response) => {
  const { page, limit, all, sortBy, sortOrder } = req.query;

  const pageNum =
    page !== undefined
      ? Number(Array.isArray(page) ? page[0] : page)
      : 1;

  const limitNum =
    limit !== undefined
      ? Number(Array.isArray(limit) ? limit[0] : limit)
      : 10;

  const rawSortBy = Array.isArray(sortBy) ? sortBy?.[0] : sortBy;
  const sortByStr = (rawSortBy ?? 'username').toString();

  const rawSortOrder = Array.isArray(sortOrder) ? sortOrder?.[0] : sortOrder;
  const sortOrderStr = (rawSortOrder ?? 'asc').toString().toLowerCase();

  const validColumns = ['username', 'email', 'id'];

  if (!validColumns.includes(sortByStr)) {
    return res.status(400).json({ error: 'Invalid sort column.' });
  }

  if (!['asc', 'desc'].includes(sortOrderStr)) {
    return res.status(400).json({ error: 'Invalid sort order.' });
  }

  try {
    if (all === 'true') {
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
        .all();

      return res.status(200).json({
        total: users.length,
        users,
      });
    }

    const offset = (pageNum - 1) * limitNum;

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
      .all(limitNum, offset);

    return res.status(200).json({
      total: totalRow.count,
      users,
      page: pageNum,
      limit: limitNum,
    });
  } catch (error) {
    console.error('Failed to fetch users:', error);
    return res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// GET /users/:id
router.get('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = db
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
      .get(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error('Failed to retrieve user', err);
    return res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// PUT /users/:id
router.put('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { username, email, passwordHash } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const updateUser = db.prepare(`
      UPDATE users
      SET
        username = COALESCE(?, username),
        email = COALESCE(?, email),
        password_hash = COALESCE(?, password_hash)
      WHERE id = ?
    `);

    const result = updateUser.run(username, email, passwordHash, id);

    if (result.changes === 0) {
      return res
        .status(404)
        .json({ error: 'User not found or no changes made' });
    }

    return res.status(200).json({ message: 'User updated successfully' });
  } catch (err) {
    console.error('Failed to update user', err);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

// DELETE /users/:id
router.delete('/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const deleteUser = db.prepare(`DELETE FROM users WHERE id = ?`);
    const result = deleteUser.run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 204 No Content
    return res.status(204).end();
  } catch (err) {
    console.error('Failed to delete user', err);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * PUT /api/users/:id/password
 */
router.put('/api/users/:id/password', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body ?? {};

  if (!id || !currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const user = db
      .prepare('SELECT id, password_hash FROM users WHERE id = ?')
      .get(id) as { id: number; password_hash: string } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{12,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        error:
          'New password must be at least 12 characters long, include a number, a letter, and a special character.',
      });
    }

    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      newPasswordHash,
      id
    );

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to update password', 500);
  }
});

router.all('/api/users/:id/password', (req: Request, res: Response) => {
  res.setHeader('Allow', 'PUT');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
