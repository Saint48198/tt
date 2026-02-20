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
  public async getTrips(): Promise<Trip[]> {
    return db.all<Trip>(
      'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips."countryId" = countries.id'
    );
  }

  /**
   * Get a trip by ID with country information
   */
  public async getTripById(id: number | string): Promise<Trip | undefined> {
    return db.get<Trip>(
      'SELECT trips.*, countries.name as country FROM trips JOIN countries ON trips."countryId" = countries.id WHERE trips.id = $1',
      [id]
    );
  }

  /**
   * Create a new trip
   */
  public async createTrip(data: CreateTripData): Promise<{ id: number }> {
    const { destination, startDate, endDate, notes, countryId } = data;
    const result = await db.run(
      'INSERT INTO trips (destination, "startDate", "endDate", notes, "countryId") VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [destination, startDate, endDate, notes, countryId]
    );
    return { id: result.rows[0].id };
  }

  /**
   * Update a trip
   */
  public async updateTrip(
    id: number | string,
    data: UpdateTripData
  ): Promise<{ success: boolean; changes: number }> {
    const { destination, startDate, endDate, notes, countryId } = data;
    const result = await db.run(
      'UPDATE trips SET destination=$1, "startDate"=$2, "endDate"=$3, notes=$4, "countryId"=$5 WHERE id=$6',
      [destination, startDate, endDate, notes, countryId, id]
    );
    return { success: result.rowCount > 0, changes: result.rowCount };
  }

  /**
   * Delete a trip
   */
  public async deleteTrip(id: number | string): Promise<{ success: boolean; changes: number }> {
    const result = await db.run('DELETE FROM trips WHERE id = $1', [id]);
    return { success: result.rowCount > 0, changes: result.rowCount };
  }
}

export const tripService = TripService.getInstance();

