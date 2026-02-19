import { db } from '../db';

interface Trip {
  id: number;
  destination: string;
  startDate: string;
  endDate: string;
  notes?: string;
  countryId: number;
  country: string;
}

interface CreateTripData {
  destination: string;
  startDate: string;
  endDate: string;
  notes?: string;
  countryId: number;
}

interface UpdateTripData {
  destination?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  countryId?: number;
}

class TripService {
  private static instance: TripService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): TripService {
    if (!TripService.instance) {
      TripService.instance = new TripService();
    }
    return TripService.instance;
  }

  /**
   * Get all trips with country information
   */
  public getTrips(): Trip[] {
    return db
      .prepare(
        'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips.countryId = countries.id'
      )
      .all() as Trip[];
  }

  /**
   * Get a trip by ID with country information
   */
  public getTripById(id: number | string): Trip | undefined {
    return db
      .prepare(
        'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips.countryId = countries.id WHERE trips.id = ?'
      )
      .get(id) as Trip | undefined;
  }

  /**
   * Create a new trip
   */
  public createTrip(data: CreateTripData): { id: number } {
    const { destination, startDate, endDate, notes, countryId } = data;

    const result = db
      .prepare(
        'INSERT INTO trips (destination, startDate, endDate, notes, countryId) VALUES (?, ?, ?, ?, ?)'
      )
      .run(destination, startDate, endDate, notes, countryId);

    return { id: Number(result.lastInsertRowid) };
  }

  /**
   * Update a trip
   */
  public updateTrip(
    id: number | string,
    data: UpdateTripData
  ): { success: boolean; changes: number } {
    const { destination, startDate, endDate, notes, countryId } = data;

    const result = db
      .prepare(
        'UPDATE trips SET destination = ?, startDate = ?, endDate = ?, notes = ?, countryId = ? WHERE id = ?'
      )
      .run(destination, startDate, endDate, notes, countryId, id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }

  /**
   * Delete a trip
   */
  public deleteTrip(id: number | string): { success: boolean; changes: number } {
    const result = db.prepare('DELETE FROM trips WHERE id = ?').run(id);

    return {
      success: result.changes > 0,
      changes: result.changes,
    };
  }
}

export const tripService = TripService.getInstance();

