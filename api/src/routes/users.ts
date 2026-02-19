// api/src/routes/users.ts
import { Router, Request, Response } from 'express';
import { userService } from '../services/userService';
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

  try {
    const result = userService.getUsers({
      page: pageNum,
      limit: limitNum,
      all: all === 'true',
      sortBy: sortByStr,
      sortOrder: sortOrderStr,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch users.';
    return res.status(error instanceof Error && message.includes('Invalid') ? 400 : 500).json({ error: message });
  }
});

// ...existing code...

// GET /api/users/:id
router.get('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = userService.getUserById(id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(user);
  } catch (err) {
    console.error('Failed to retrieve user', err);
    return res.status(500).json({ error: 'Failed to retrieve user' });
  }
});

// PUT /api/users/:id
router.put('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const { username, email, passwordHash } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const result = userService.updateUser(id, { username, email, passwordHash });

    if (!result.success) {
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

// DELETE /api/users/:id
router.delete('/api/users/:id', (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const result = userService.deleteUser(id);

    if (!result.success) {
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
    const passwordHash = userService.getUserPasswordHash(id);

    if (!passwordHash) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await userService.verifyPassword(currentPassword, passwordHash);
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

    await userService.updateUserPassword(id, newPassword);

    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Failed to update password', 500);
  }
});

// ...existing code...

// GET, PUT, etc. not allowed on /api/user-roles
router.all('/api/user-roles', (req: Request, res: Response) => {
  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

// POST /api/user/change-password
router.post('/api/user/change-password', async (req: Request, res: Response) => {
  const { userId, currentPassword, newPassword, confirmNewPassword } = req.body;

  if (!userId || !currentPassword || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ error: 'New passwords do not match' });
  }

  // Validate password strength
  const passwordRegex =
    /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;

  if (!passwordRegex.test(newPassword)) {
    return res.status(400).json({
      error:
        'Password must be at least 12 characters long, alphanumeric, and include at least one special character.',
    });
  }

  try {
    await userService.changePassword(userId, currentPassword, newPassword);
    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';

    if (message === 'User not found') {
      return res.status(404).json({ error: message });
    }
    if (message === 'Incorrect current password') {
      return res.status(403).json({ error: message });
    }

    console.error('Error changing password:', error);
    return res.status(500).json({ error: message });
  }
});

export default router;
