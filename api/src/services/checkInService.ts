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
  public async getCheckIns(options: ListCheckInsOptions): Promise<{ checkIns: CheckIn[] }> {
    const { userId } = options;

    if (userId) {
      const checkIns = await db.all<CheckIn>(
        'SELECT * FROM user_locations WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return { checkIns };
    }

    const checkIns = await db.all<CheckIn>('SELECT * FROM user_locations ORDER BY created_at DESC');

    return { checkIns };
  }

  /**
   * Delete a check-in by ID
   */
  public async deleteCheckIn(id: string | number): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM user_locations WHERE id = $1', [id]);

    return {
      success: result.rowCount > 0,
      changes: result.rowCount,
    };
  }

  /**
   * Get all messages for a check-in
   */
  public async getCheckInMessages(checkInId: string): Promise<{ messages: CheckInMessage[] }> {
    const messages = await db.all<CheckInMessage>(
      'SELECT * FROM user_locations_messages WHERE check_in_id = $1 ORDER BY created_at ASC',
      [checkInId]
    );

    return { messages };
  }

  /**
   * Create a new check-in message
   */
  public async createCheckInMessage(data: {
    checkInId: string;
    userId: string;
    message: string;
  }): Promise<{ success: boolean }> {
    const { checkInId, userId, message } = data;

    // Verify check-in exists
    const checkInExists = await db.get('SELECT id FROM user_locations WHERE id = $1', [checkInId]);

    if (!checkInExists) {
      throw new Error('Check-in not found in user_locations.');
    }

    await db.run(
      'INSERT INTO user_locations_messages (check_in_id, user_id, message) VALUES ($1, $2, $3)',
      [checkInId, userId, message]
    );

    return { success: true };
  }
}

export const checkInService = CheckInService.getInstance();

