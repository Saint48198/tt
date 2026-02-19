import { Router, Request, Response } from 'express';
import { checkInService } from '../services/checkInService';
import { isUUID } from 'validator';

const router = Router();

// GET /api/check-ins  (optional ?userId=)
router.get('/api/check-ins', (req: Request, res: Response) => {
  // userId can be string | string[] | undefined
  const rawUserId = req.query.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  try {
    const result = checkInService.getCheckIns({
      userId: userId as string | undefined,
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching check-ins:', error);
    return res.status(500).json({ error: 'Failed to fetch check-in logs.' });
  }
});

// DELETE /api/check-ins?id=...
router.delete('/api/check-ins', (req: Request, res: Response) => {
  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id) {
    return res.status(400).json({ error: 'Check-in ID is required.' });
  }

  try {
    const result = checkInService.deleteCheckIn(id as string);

    if (!result.success) {
      return res.status(404).json({ error: 'Check-in log not found.' });
    }

    return res
      .status(200)
      .json({ message: 'Check-in log deleted successfully.' });
  } catch (error) {
    console.error('Error deleting check-in:', error);
    return res.status(500).json({ error: 'Failed to delete check-in log.' });
  }
});

// GET /api/check-ins/messages?id=<uuid>
router.get('/api/check-ins/messages', (req: Request, res: Response) => {
  const rawId = req.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!id || typeof id !== 'string' || !isUUID(id)) {
    return res.status(400).json({ error: 'Check-in ID is required.' });
  }

  try {
    const result = checkInService.getCheckInMessages(id);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Failed to fetch messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// POST /api/check-ins/messages
router.post('/api/check-ins/messages', (req: Request, res: Response) => {
  const { checkInId, userId, message } = req.body;

  if (!checkInId || !userId || !message) {
    return res.status(400).json({
      error: 'Check-in ID, user ID, and message are required.',
    });
  }

  try {
    checkInService.createCheckInMessage({
      checkInId,
      userId,
      message,
    });

    return res.status(201).json({ message: 'Message added successfully.' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to add message.';

    if (errorMessage.includes('not found')) {
      return res.status(404).json({ error: errorMessage });
    }

    console.error('Failed to add message:', error);
    return res.status(500).json({ error: 'Failed to add message.' });
  }
});

export default router;
