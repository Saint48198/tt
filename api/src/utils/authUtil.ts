import { Request, Response } from 'express';
import { verifyToken } from './jwt';

export interface JWTPayload {
  id: number;
  username?: string | undefined;
  email?: string | undefined;
  roles?: string[] | undefined;
}

export async function authenticateRequest(req: Request, res: Response): Promise<JWTPayload | null> {
  // Accept token from cookie or Authorization: Bearer <token> header
  const authToken =
    req.cookies?.auth_token ||
    (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);

  if (!authToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  try {
    const payload = verifyToken(authToken);
    return payload;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}
