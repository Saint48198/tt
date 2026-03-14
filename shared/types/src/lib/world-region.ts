export interface WorldRegion {
  id: number;
  name: string;
  created_date?: string;
  sub_regions?: WorldSubRegion[];
}

export interface WorldSubRegion {
  id: number;
  name: string;
  world_region_id: number;
  region_name?: string;
  created_date?: string;
}
