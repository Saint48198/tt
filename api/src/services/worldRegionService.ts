import { db } from '../db';

interface WorldRegion {
  id: number;
  name: string;
  created_date?: string;
}

interface WorldSubRegion {
  id: number;
  name: string;
  world_region_id: number;
  region_name?: string;
  created_date?: string;
}

class WorldRegionService {
  private static instance: WorldRegionService;

  private constructor() {}

  public static getInstance(): WorldRegionService {
    if (!WorldRegionService.instance) {
      WorldRegionService.instance = new WorldRegionService();
    }
    return WorldRegionService.instance;
  }

  /** Get all world regions */
  public async getRegions(): Promise<WorldRegion[]> {
    return db.all<WorldRegion>('SELECT * FROM world_regions ORDER BY name');
  }

  /** Get all world regions with their sub-regions attached */
  public async getRegionsWithSubRegions(): Promise<
    (WorldRegion & { sub_regions: WorldSubRegion[] })[]
  > {
    const regions = await db.all<WorldRegion>('SELECT * FROM world_regions ORDER BY name');
    const subRegions = await db.all<WorldSubRegion>(
      'SELECT * FROM world_sub_regions ORDER BY name'
    );

    const subMap = new Map<number, WorldSubRegion[]>();
    for (const sr of subRegions) {
      if (!subMap.has(sr.world_region_id)) subMap.set(sr.world_region_id, []);
      subMap.get(sr.world_region_id)!.push(sr);
    }

    return regions.map((r) => ({
      ...r,
      sub_regions: subMap.get(r.id) || [],
    }));
  }

  /** Get all sub-regions, optionally filtered by region */
  public async getSubRegions(regionId?: number): Promise<WorldSubRegion[]> {
    if (regionId) {
      return db.all<WorldSubRegion>(
        `SELECT ws.*, wr.name AS region_name
         FROM world_sub_regions ws
         JOIN world_regions wr ON ws.world_region_id = wr.id
         WHERE ws.world_region_id = $1
         ORDER BY ws.name`,
        [regionId]
      );
    }
    return db.all<WorldSubRegion>(
      `SELECT ws.*, wr.name AS region_name
       FROM world_sub_regions ws
       JOIN world_regions wr ON ws.world_region_id = wr.id
       ORDER BY wr.name, ws.name`
    );
  }
}

export const worldRegionService = WorldRegionService.getInstance();
