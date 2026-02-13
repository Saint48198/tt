import { Router, Request, Response } from 'express';
import { db } from '../db';
import { verifyToken } from '../utils/jwt';

const router = Router();

// GET /users/token
router.get('/users/token', async (req: Request, res: Response) => {
  try {
    const { auth_token } = req.cookies ?? {};

    if (!auth_token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = await verifyToken(auth_token);

    if (!payload) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch google_access_token for this user
    const row = db
      .prepare(`SELECT google_access_token FROM users WHERE id = ?`)
      .get(payload.id) as { google_access_token: string } | undefined;

    const token = row?.google_access_token;

    if (!token) {
      return res.status(404).json({ error: 'Google access token not found' });
    }

    return res.status(200).json({ accessToken: token });
  } catch (error) {
    console.error('Error fetching user token:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
