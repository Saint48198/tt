import { Router, Request, Response } from 'express';
import { profileService } from '../services/profileService';

const router = Router();

/**
 * GET /api/public/profile/:username
 * Public endpoint — no auth required.
 * Returns a user's visited countries for their public map profile.
 */
router.get('/api/public/profile/:username', async (req: Request, res: Response) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const profile = await profileService.getPublicProfile(username);

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Failed to fetch public profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;

