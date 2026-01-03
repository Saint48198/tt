// api/src/routes/users.ts
import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';
import { handleApiError } from '../utils/errorHandler';
import { User } from '@shared/types';

const router = Router();

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
      .get(id) as User;

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
