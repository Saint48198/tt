export interface WordCloudItem {
  text: string;
  count: number;
}

/** Which filter groups are shown in the UI */
export type WordCloudFilterGroup = 'time' | 'location' | 'place';

/** Single object used to drive all word cloud filters */
export interface WordCloudFilters {
  year?: number | null;
  countryId?: number | null;
  stateId?: number | null;
  cityId?: number | null;
  attractionId?: number | null;
}
