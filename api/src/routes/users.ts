// api/src/routes/users.ts
import { Router, Request, Response } from 'express';
import formidable from 'formidable';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { userService } from '../services/userService';
import { handleApiError } from '../utils/errorHandler';

const AVATARS_DIR = path.join(__dirname, '..', 'uploads', 'avatars');

const router = Router();

// GET /api/users - List all users with pagination and sorting
router.get('/api/users', async (req: Request, res: Response) => {
  const { page, limit, all, sortBy, sortOrder, includeDisabled } = req.query;

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
    const result = await userService.getUsers({
      page: pageNum,
      limit: limitNum,
      all: all === 'true',
      sortBy: sortByStr,
      sortOrder: sortOrderStr,
      includeDisabled: includeDisabled === 'true',
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch users.';
    return res.status(error instanceof Error && message.includes('Invalid') ? 400 : 500).json({ error: message });
  }
});

// GET /api/users/:id
router.get('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = await userService.getUserById(id);

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
router.put('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const { email, passwordHash, profile_icon, instagram, portfolio_url } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const result = await userService.updateUser(id, { email, passwordHash, profile_icon, instagram, portfolio_url });

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
router.delete('/api/users/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const result = await userService.deleteUser(id);

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
    const passwordHash = await userService.getUserPasswordHash(id);

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

/**
 * POST /api/users/:id/avatar - Upload a profile icon image
 */
router.post('/api/users/:id/avatar', async (req: Request, res: Response): Promise<any> => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  // Ensure avatars directory exists
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }

  const form = formidable({
    maxFileSize: 5 * 1024 * 1024, // 5MB
    filter: ({ mimetype }) => !!mimetype && mimetype.startsWith('image/'),
  });

  form.parse(req, async (err: any, _fields: any, files: any) => {
    if (err) {
      console.error('Avatar upload parse error:', err);
      if (err.code === 1009) {
        return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
      }
      return res.status(500).json({ error: 'Error parsing upload' });
    }

    const fileField = files.file;
    const file = Array.isArray(fileField) ? fileField[0] : fileField;

    if (!file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    try {
      // Resize and convert to webp
      const filename = `avatar-${id}-${Date.now()}.webp`;
      const outputPath = path.join(AVATARS_DIR, filename);

      await sharp(file.filepath)
        .resize(256, 256, { fit: 'cover' })
        .webp({ quality: 85 })
        .toFile(outputPath);

      // Clean up temp file
      try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }

      // Delete old avatar file if it exists
      const existingUser = await userService.getUserById(id);
      if (existingUser?.profile_icon) {
        const oldFilename = existingUser.profile_icon.split('/').pop();
        if (oldFilename) {
          const oldPath = path.join(AVATARS_DIR, oldFilename);
          try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
        }
      }

      // Save the path to the database
      const avatarUrl = `/api/uploads/avatars/${filename}`;
      await userService.updateUser(id, { profile_icon: avatarUrl });

      return res.status(200).json({ profile_icon: avatarUrl });
    } catch (uploadErr) {
      console.error('Avatar processing error:', uploadErr);
      try { fs.unlinkSync(file.filepath); } catch { /* ignore */ }
      return res.status(500).json({ error: 'Failed to process avatar image' });
    }
  });
});

/**
 * DELETE /api/users/:id/avatar - Remove the profile icon
 */
router.delete('/api/users/:id/avatar', async (req: Request, res: Response) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const existingUser = await userService.getUserById(id);

    if (existingUser?.profile_icon) {
      const oldFilename = existingUser.profile_icon.split('/').pop();
      if (oldFilename) {
        const oldPath = path.join(AVATARS_DIR, oldFilename);
        try { fs.unlinkSync(oldPath); } catch { /* ignore */ }
      }
    }

    // Clear profile_icon in DB — use a dedicated method to set null
    await userService.clearProfileIcon(id);

    return res.status(200).json({ message: 'Avatar removed successfully' });
  } catch (err) {
    console.error('Failed to remove avatar:', err);
    return res.status(500).json({ error: 'Failed to remove avatar' });
  }
});


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
