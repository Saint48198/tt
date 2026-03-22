import { db } from '../db';

interface DashboardStats {
  totalUsers: number;
  totalCountries: number;
  totalStates: number;
  totalCities: number;
  totalAttractions: number;
  totalPhotos: number;
}

interface EntityBreakdown {
  name: string;
  value: number;
}

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface PhotosByEntity {
  entity: string;
  count: number;
}

interface CountriesPerRegion {
  region: string;
  count: number;
}

interface PhotosByCountry {
  country: string;
  count: number;
}

export interface AnalyticsData {
  entityBreakdown: EntityBreakdown[];
  photosByMonth: TimeSeriesPoint[];
  photosByEntity: PhotosByEntity[];
  countriesPerRegion: CountriesPerRegion[];
  photosPerYear: TimeSeriesPoint[];
  photosByCountry: PhotosByCountry[];
  entityGrowth: {
    month: string;
    countries: number;
    states: number;
    cities: number;
    attractions: number;
  }[];
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
        const row = await db.get<{ count: string }>(
          `SELECT COUNT(*) AS count FROM ${table} WHERE disabled_date IS NULL`
        );
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

  public async getAnalytics(): Promise<AnalyticsData> {
    const [
      entityBreakdown,
      photosByMonth,
      photosByEntity,
      countriesPerRegion,
      photosPerYear,
      photosByCountry,
      entityGrowth,
    ] = await Promise.all([
      this.getEntityBreakdown(),
      this.getPhotosByMonth(),
      this.getPhotosByEntity(),
      this.getCountriesPerRegion(),
      this.getPhotosPerYear(),
      this.getPhotosByCountry(),
      this.getEntityGrowth(),
    ]);

    return {
      entityBreakdown,
      photosByMonth,
      photosByEntity,
      countriesPerRegion,
      photosPerYear,
      photosByCountry,
      entityGrowth,
    };
  }

  /** Donut chart: counts of each entity type */
  private async getEntityBreakdown(): Promise<EntityBreakdown[]> {
    const tables = [
      { name: 'Countries', table: 'countries' },
      { name: 'States', table: 'states' },
      { name: 'Cities', table: 'cities' },
      { name: 'Attractions', table: 'attractions' },
      { name: 'Photos', table: 'photos' },
      { name: 'Trips', table: 'trips' },
    ];

    const results: EntityBreakdown[] = [];
    for (const t of tables) {
      try {
        const hasDisabled = t.table !== 'trips';
        const where = hasDisabled ? ' WHERE disabled_date IS NULL' : '';
        const row = await db.get<{ count: string }>(
          `SELECT COUNT(*) AS count FROM ${t.table}${where}`
        );
        results.push({ name: t.name, value: Number(row?.count ?? 0) });
      } catch {
        results.push({ name: t.name, value: 0 });
      }
    }
    return results;
  }

  /** Bar chart: photos by capture date per month */
  private async getPhotosByMonth(): Promise<TimeSeriesPoint[]> {
    try {
      const rows = await db.all<{ month: string; count: string }>(
        `SELECT TO_CHAR(created_date, 'YYYY-MM') AS month, COUNT(*) AS count
         FROM photos
         WHERE disabled_date IS NULL
           AND created_date IS NOT NULL
         GROUP BY TO_CHAR(created_date, 'YYYY-MM')
         ORDER BY month`
      );
      return rows.map((r) => ({ date: r.month, count: Number(r.count) }));
    } catch (err) {
      console.error('Failed to get photos by month:', err);
      return [];
    }
  }

  /** Horizontal bar: photos grouped by entity type assignment */
  private async getPhotosByEntity(): Promise<PhotosByEntity[]> {
    try {
      const queries = [
        {
          entity: 'Country',
          sql: `SELECT COUNT(*) AS count FROM photos
                WHERE country_id IS NOT NULL AND disabled_date IS NULL`,
        },
        {
          entity: 'State',
          sql: `SELECT COUNT(*) AS count FROM photos
                WHERE state_id IS NOT NULL AND disabled_date IS NULL`,
        },
        {
          entity: 'City',
          sql: `SELECT COUNT(*) AS count FROM photos
                WHERE city_id IS NOT NULL AND disabled_date IS NULL`,
        },
        {
          entity: 'Attraction',
          sql: `SELECT COUNT(*) AS count FROM photos
                WHERE attraction_id IS NOT NULL AND disabled_date IS NULL`,
        },
        {
          entity: 'Unassigned',
          sql: `SELECT COUNT(*) AS count FROM photos
                WHERE country_id IS NULL AND state_id IS NULL
                  AND city_id IS NULL AND attraction_id IS NULL
                  AND disabled_date IS NULL`,
        },
      ];

      const results: PhotosByEntity[] = [];
      for (const q of queries) {
        const row = await db.get<{ count: string }>(q.sql);
        results.push({ entity: q.entity, count: Number(row?.count ?? 0) });
      }
      return results;
    } catch (err) {
      console.error('Failed to get photos by entity:', err);
      return [];
    }
  }

  /** Bar chart: visited countries grouped by world region */
  private async getCountriesPerRegion(): Promise<CountriesPerRegion[]> {
    try {
      const rows = await db.all<{ region: string; count: string }>(
        `SELECT wr.name AS region, COUNT(c.id) AS count
         FROM countries c
         JOIN world_regions wr ON c.world_region_id = wr.id
         WHERE c.disabled_date IS NULL
         GROUP BY wr.name
         ORDER BY count DESC`
      );
      return rows.map((r) => ({ region: r.region, count: Number(r.count) }));
    } catch (err) {
      console.error('Failed to get countries per region:', err);
      return [];
    }
  }

  /** Line chart: photos created per year */
  private async getPhotosPerYear(): Promise<TimeSeriesPoint[]> {
    try {
      const rows = await db.all<{ year: string; count: string }>(
        `SELECT TO_CHAR(created_date, 'YYYY') AS year, COUNT(*) AS count
         FROM photos
         WHERE disabled_date IS NULL AND created_date IS NOT NULL
         GROUP BY TO_CHAR(created_date, 'YYYY')
         ORDER BY year`
      );
      return rows.map((r) => ({ date: r.year, count: Number(r.count) }));
    } catch (err) {
      console.error('Failed to get photos per year:', err);
      return [];
    }
  }

  /** Scatter plot: all-time photo count per country */
  private async getPhotosByCountry(): Promise<PhotosByCountry[]> {
    try {
      const rows = await db.all<{ country: string; count: string }>(
        `SELECT c.name AS country, COUNT(p.id) AS count
         FROM photos p
         JOIN countries c ON p.country_id = c.id
         WHERE p.disabled_date IS NULL
           AND c.disabled_date IS NULL
         GROUP BY c.name
         ORDER BY count DESC`
      );
      return rows.map((r) => ({ country: r.country, count: Number(r.count) }));
    } catch (err) {
      console.error('Failed to get photos by country:', err);
      return [];
    }
  }

  /** Stacked area: entity creation over time (monthly) */
  private async getEntityGrowth(): Promise<
    {
      month: string;
      countries: number;
      states: number;
      cities: number;
      attractions: number;
    }[]
  > {
    try {
      const tables = ['countries', 'states', 'cities', 'attractions'] as const;
      const dataSets: Record<string, Record<string, number>> = {};

      for (const table of tables) {
        const rows = await db.all<{ month: string; count: string }>(
          `SELECT TO_CHAR(created_date, 'YYYY-MM') AS month, COUNT(*) AS count
           FROM ${table}
           WHERE disabled_date IS NULL AND created_date IS NOT NULL
           GROUP BY TO_CHAR(created_date, 'YYYY-MM')
           ORDER BY month`
        );
        for (const r of rows) {
          if (!dataSets[r.month]) {
            dataSets[r.month] = {
              countries: 0,
              states: 0,
              cities: 0,
              attractions: 0,
            };
          }
          dataSets[r.month][table] = Number(r.count);
        }
      }

      return Object.entries(dataSets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, data]) => ({
          month,
          countries: data.countries ?? 0,
          states: data.states ?? 0,
          cities: data.cities ?? 0,
          attractions: data.attractions ?? 0,
        }));
    } catch (err) {
      console.error('Failed to get entity growth:', err);
      return [];
    }
  }
}

export const statsService = StatsService.getInstance(); // singleton
