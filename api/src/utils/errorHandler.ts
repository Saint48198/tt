import { Response } from 'express';

export function handleApiError(err: unknown, res: Response, message: string, status = 400) {
  if (err instanceof Error) {
    return res.status(status).json({
      error: message,
      details: err.message,
    });
  }

  return res.status(status).json({
    error: message,
    details: 'Unknown error',
  });
}
