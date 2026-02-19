import { db } from '../db';

interface CheckIn {
  id: number;
  user_id: string;
  created_at: string;
}

interface CheckInMessage {
  id?: number;
  check_in_id: string;
  user_id: string;
  message: string;
  created_at?: string;
}

interface ListCheckInsOptions {
  userId?: string;
}

class CheckInService {
  private static instance: CheckInService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): CheckInService {
    if (!CheckInService.instance) {
      CheckInService.instance = new CheckInService();
    }
    return CheckInService.instance;
  }

  /**
   * Get all check-ins or filter by user ID
   */
  public getCheckIns(options: ListCheckInsOptions): { checkIns: CheckIn[] } {
    const { userId } = options;

    let query = 'SELECT * FROM user_locations ORDER BY created_at DESC';
    const params: (string | undefined)[] = [];

    if (userId) {
      query =
        'SELECT * FROM user_locations WHERE user_id = ? ORDER BY created_at DESC';
      params.push(userId);
    }

    const checkIns = db.prepare(query).all(...params) as CheckIn[];

    return { checkIns };
  }

  /**
   * Delete a check-in by ID
   */
  public deleteCheckIn(id: string | number): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM user_locations WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Get all messages for a check-in
   */
  public getCheckInMessages(checkInId: string): { messages: CheckInMessage[] } {
    const messages = db
      .prepare(
        'SELECT * FROM check_in_messages WHERE check_in_id = ? ORDER BY created_at ASC'
      )
      .all(checkInId) as CheckInMessage[];

    return { messages };
  }

  /**
   * Create a new check-in message
   */
  public createCheckInMessage(data: {
    checkInId: string;
    userId: string;
    message: string;
  }): { success: boolean } {
    const { checkInId, userId, message } = data;

    // Verify check-in exists
    const checkInExists = db
      .prepare('SELECT id FROM user_locations WHERE id = ?')
      .get(checkInId);

    if (!checkInExists) {
      throw new Error('Check-in not found in user_locations.');
    }

    db.prepare(
      'INSERT INTO user_locations_messages (check_in_id, user_id, message) VALUES (?, ?, ?)'
    ).run(checkInId, userId, message);

    return { success: true };
  }
}

export const checkInService = CheckInService.getInstance();

