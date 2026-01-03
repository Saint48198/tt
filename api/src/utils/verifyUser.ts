import { db } from '../db';
import bcrypt from 'bcrypt';
import { VerifyUserResult, User } from '@shared/types';

/**
 * Verifies a user's credentials against the database.
 * @param username - The username of the user attempting to log in.
 * @param password - The plaintext password to validate.
 * @returns { user } on success, or { error, details? } on failure.
 */
export async function verifyUser(username: string, password: string): Promise<VerifyUserResult> {
  if (!username || !password) {
    return { user: null, error: 'Username and password are required' };
  }

  try {
    // Fetch user by username
    const query = 'SELECT * FROM users WHERE username = ? LIMIT 1';
    const user = db.prepare(query).get(username) as User;

    if (!user) {
      return { user: null, error: 'Invalid username or password' };
    }

    // Validate password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return { user: null, error: 'Invalid username or password' };
    }

    return { user };
  } catch (error: any) {
    return { user: null,  error: 'Internal Server Error', details: error.message };
  }
}
