import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;

export function isSessionValid(token: string) {
  if (!JWT_SECRET) {
    return { valid: false, error: 'JWT_SECRET is not set' };
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, decoded };
  } catch (error: unknown) {
    if (error instanceof Error) {
      return { valid: false, error: error.message };
    }
    return { valid: false, error: 'Unknown error' };
  }
}
