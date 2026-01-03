import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db';

const router = Router();

// POST /user/change-password
router.post('/user/change-password', async (req: Request, res: Response) => {
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
    // Fetch the user
    const user = db
      .prepare('SELECT password_hash FROM users WHERE id = ?')
      .get(userId) as { password_hash: string } | undefined;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isMatch) {
      return res.status(403).json({ error: 'Incorrect current password' });
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      newPasswordHash,
      userId
    );

    return res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
