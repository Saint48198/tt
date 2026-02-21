import { db } from '../db';

interface DashboardStats {
  totalUsers: number;
  totalCountries: number;
  totalStates: number;
  totalCities: number;
  totalAttractions: number;
  totalPhotos: number;
}

class StatsService {
  private static instance: StatsService;

  private constructor() {
    // Private constructor prevents direct instantiation
  }

  public static getInstance(): StatsService {
    if (!StatsService.instance) {
      StatsService.instance = new StatsService();
    }
    return StatsService.instance;
  }

  public async getDashboardStats(): Promise<DashboardStats> {
    const safeCount = async (table: string): Promise<number> => {
      try {
        const row = await db.get<{ count: string }>(`SELECT COUNT(*) AS count FROM ${table} WHERE disabled_date IS NULL`);
        return Number(row?.count ?? 0);
      } catch (err) {
        console.error(`Failed to count ${table}:`, err);
        return 0;
      }
    };

    const [totalUsers, totalCountries, totalStates, totalCities, totalAttractions, totalPhotos] =
      await Promise.all([
        safeCount('users'),
        safeCount('countries'),
        safeCount('states'),
        safeCount('cities'),
        safeCount('attractions'),
        safeCount('photos'),
      ]);

    return { totalUsers, totalCountries, totalStates, totalCities, totalAttractions, totalPhotos };
  }
}

export const statsService = StatsService.getInstance();

