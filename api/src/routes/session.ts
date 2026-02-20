import { Router, Request, Response } from 'express';
import { isSessionValid, sessionService } from '../services/sessionService';
import { userService } from '../services/userService';
import { verifyToken } from '../utils/jwt';
import jwt from 'jsonwebtoken';

const router = Router();

// POST /api/login
router.post('/api/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const result = await sessionService.login({ username, password });

    // Set token in HTTP-only cookie
    res.setHeader('Set-Cookie', `auth_token=${result.token}; HttpOnly; Path=/;`);

    return res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';

    if (message === 'Invalid credentials') {
      return res.status(401).json({ error: message });
    }

    if (message.includes('required')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// POST /api/logout
router.post('/api/logout', async (req: Request, res: Response) => {
  // Extract token from Authorization header or cookie
  const authHeader = req.headers.authorization;
  const tokenFromHeader = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;

  const token = tokenFromHeader || req.cookies?.auth_token;

  try {
    await sessionService.logout(token);

    // Clear auth cookie
    res.setHeader('Set-Cookie', `auth_token=; HttpOnly; Path=/; Max-Age=0`);

    return res.status(200).json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    const message = error instanceof Error ? error.message : 'Logout failed';

    if (message === 'Token missing') {
      return res.status(400).json({ error: message });
    }

    if (message.includes('Invalid') || message.includes('already logged out')) {
      return res.status(400).json({ error: message });
    }

    return res.status(500).json({ error: message });
  }
});

// ...existing code...
router.get('/api/session', (req: Request, res: Response) => {
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ error: 'Token not provided' });
  }

  const result = isSessionValid(token);

  if (!result.valid) {
    return res
      .status(401)
      .json({ error: 'Invalid session', details: result.error });
  }

  return res.status(200).json({
    message: 'Session is valid',
    user: result.decoded,
  });
});

// POST /api/verify-token
router.post('/api/verify-token', async (req: Request, res: Response) => {
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
    const tokenExists = await sessionService.verifyTokenExists(token);

    if (!tokenExists) {
      return res
        .status(401)
        .json({ error: 'Invalid or revoked token' });
    }

    return res.status(200).json({ valid: true, user: decoded });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Invalid token';
    return res
      .status(401)
      .json({ error: 'Invalid token', details: errorMessage });
  }
});

// GET /api/users/token
router.get('/api/users/token', async (req: Request, res: Response) => {
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
    const token = await userService.getGoogleAccessToken(payload.id);

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
