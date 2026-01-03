import { Router, Request, Response } from 'express';
import { isSessionValid } from '../services/sessionService';

const router = Router();

// GET /session
router.get('/session', (req: Request, res: Response) => {
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

export default router;
