import { Router, Request, Response } from 'express';
import { db } from '../db';

const router = Router();

// POST /logout
router.post('/logout', (req: Request, res: Response) => {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  const token = tokenFromHeader || req.cookies?.auth_token;

  if (!token) {
    return res.status(400).json({ error: 'Token missing' });
  }

  // Delete the token from the database
  const result = db
    .prepare(`DELETE FROM user_tokens WHERE token = ?`)
    .run(token);

  if (result.changes === 0) {
    return res.status(400).json({ error: 'Invalid or already logged out' });
  }

  // Clear auth cookie
  res.setHeader('Set-Cookie', `auth_token=; HttpOnly; Path=/; Max-Age=0`);

  return res.status(200).json({ message: 'Logout successful' });
});

export default router;
