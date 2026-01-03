import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { TokenResponse } from '@shared/types';

const router = Router();

// POST /verify-token
router.post('/verify-token', (req: Request, res: Response) => {
  const { token } = req.body;

  if (!token) {
    return res.status(400).json({ error: 'Token is missing' });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      id: number;
      username: string;
      email: string;
      roles: string[];
    };

    // Check if token exists in DB
    const row = db
      .prepare(`SELECT COUNT(*) AS count FROM user_tokens WHERE token = ?`)
      .get(token) as TokenResponse;

    if (!row || row.count === 0) {
      return res
        .status(401)
        .json({ error: 'Invalid or revoked token' });
    }

    return res.status(200).json({ valid: true, user: decoded });
  } catch (error: any) {
    return res
      .status(401)
      .json({ error: 'Invalid token', details: error.message });
  }
});

export default router;
