import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { verifyUser } from '../utils/verifyUser';
import { Role } from '@shared/types';

const router = Router();

// POST /login
router.post('/login', async (req: Request, res: Response) => {
  if (req.method !== 'POST') {
    // Express will only hit this handler for POST if you mounted router.post,
    // but keeping the check to mirror the original behavior.
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { username, password } = req.body;

  try {
    const { user, error, details } = await verifyUser(username, password);

    if (error) {
      return res
        .status(error === 'Internal Server Error' ? 500 : 400)
        .json({ error, details });
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Fetch roles for the user
    const roles = (db
      .prepare(
        `SELECT roles.name
         FROM roles
         INNER JOIN user_roles ON roles.id = user_roles.role_id
         WHERE user_roles.user_id = ?`
      )
      .all(user.id) as Role[])
      .map((role: { name: string }) => role.name);

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Create JWT payload
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      roles,
    };

    // Generate JWT (no expiration, same as original)
    const token = jwt.sign(payload, process.env.JWT_SECRET as string);

    // Store token in database
    db.prepare(`INSERT INTO user_tokens (user_id, token) VALUES (?, ?)`).run(
      user.id,
      token
    );

    // Set token in HTTP-only cookie
    res.setHeader('Set-Cookie', `auth_token=${token}; HttpOnly; Path=/;`);

    return res.status(200).json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
