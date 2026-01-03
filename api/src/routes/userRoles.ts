import { Router, Request, Response } from 'express';
import { db } from '../db';
import { handleApiError } from '../utils/errorHandler';

const router = Router();

/**
 * POST /api/user-roles
 * Body: { userId, roleId }
 */
router.post('/api/user-roles', (req: Request, res: Response) => {
  const { userId, roleId } = req.body ?? {};

  if (!userId || !roleId) {
    return res.status(400).json({ error: 'Missing userId or roleId' });
  }

  try {
    db.prepare(
      `
      INSERT INTO user_roles (user_id, role_id)
      VALUES (?, ?)
    `
    ).run(userId, roleId);

    return res.status(201).json({ message: 'Role assigned to user' });
  } catch (err: unknown) {
    return handleApiError(err, res, 'Role assignment failed');
  }
});

/**
 * DELETE /api/user-roles?userId=...&roleId=...
 */
router.delete('/api/user-roles', (req: Request, res: Response) => {
  const userId = req.query.userId as string | undefined;
  const roleId = req.query.roleId as string | undefined;

  if (!userId || !roleId) {
    return res.status(400).json({ error: 'Missing userId or roleId' });
  }

  try {
    db.prepare(
      `
      DELETE FROM user_roles
      WHERE user_id = ? AND role_id = ?
    `
    ).run(userId, roleId);

    return res.status(204).end();
  } catch (err: unknown) {
    return handleApiError(err, res, 'Role removal failed');
  }
});

router.all('/api/user-roles', (req: Request, res: Response) => {
  res.setHeader('Allow', 'POST, DELETE');
  return res.status(405).end(`Method ${req.method} Not Allowed`);
});

export default router;
