import { db } from '../db';

interface PlanItem {
  id: number;
  order: number;
  type: string;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
}

interface Trip {
  id: number;
  name: string;
  notes?: string;
  plan: PlanItem[];
  created_date?: string;
  updated_date?: string;
}

interface CountryVisited {
  country: string;
  lastVisited: string;
  lat: number;
  lng: number;
}

interface CreateTripData {
  name: string;
  notes?: string;
  plan?: PlanItem[];
}

interface UpdateTripData {
  name?: string;
  notes?: string;
  plan?: PlanItem[];
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
   * Get all trips
   */
  public async getTrips(): Promise<Trip[]> {
    return db.all<Trip>('SELECT * FROM trips ORDER BY created_date DESC');
  }

  /**
   * Get a trip by ID
   */
  public async getTripById(id: number | string): Promise<Trip | undefined> {
    return db.get<Trip>('SELECT * FROM trips WHERE id = $1', [id]);
  }

  /**
   * Normalize plan items: sort by `order` (falling back to `startDate` for
   * legacy items that pre-date the order field), then reassign sequential
   * `id` and `order` values (1, 2, 3…).  This guarantees both fields are
   * always unique, positive, and reflect the intended display order.
   */
  private normalizePlan(items: PlanItem[]): PlanItem[] {
    const sorted = [...items].sort((a, b) => {
      const aOrder = a.order != null ? a.order : Infinity;
      const bOrder = b.order != null ? b.order : Infinity;
      if (aOrder !== bOrder) return aOrder - bOrder;
      // Fallback: sort by startDate for items without order
      const dateA = a.startDate ? new Date(a.startDate).getTime() : Infinity;
      const dateB = b.startDate ? new Date(b.startDate).getTime() : Infinity;
      return dateA - dateB;
    });
    return sorted.map((item, index) => ({ ...item, id: index + 1, order: index + 1 }));
  }

  /**
   * Create a new trip
   */
  public async createTrip(data: CreateTripData): Promise<{ id: number }> {
    const { name, notes, plan } = data;
    const sortedPlan = this.normalizePlan(plan || []);
    const result = await db.run(
      'INSERT INTO trips (name, notes, plan) VALUES ($1, $2, $3) RETURNING id',
      [name, notes || null, JSON.stringify(sortedPlan)]
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
    const { name, notes, plan } = data;
    const sortedPlan = this.normalizePlan(plan || []);
    const result = await db.run(
      'UPDATE trips SET name = $1, notes = $2, plan = $3, updated_date = NOW() WHERE id = $4',
      [name, notes || null, JSON.stringify(sortedPlan), id]
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

  /**
   * Get countries visited in the last 5 years based on last_visited date
   */
  public async getCountriesVisitedLastFiveYears(): Promise<CountryVisited[]> {
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    return db.all<CountryVisited>(
      `SELECT
         name        AS country,
         last_visited AS "lastVisited",
         lat,
         lng
       FROM countries
       WHERE last_visited >= $1 AND disabled_date IS NULL
       ORDER BY last_visited DESC`,
      [fiveYearsAgo]
    );
  }
}

export const tripService = TripService.getInstance();
