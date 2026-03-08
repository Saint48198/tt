export interface Trip {
  id: number;
  name: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
  plan: PlanItem[];
  created_date?: string;
  updated_date?: string;
}

export interface PlanItem {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  [key: string]: unknown;
}

export interface PlanFlight extends PlanItem {
  type: 'flight';
  from: string;
  fromCountryId: number;
  to: string;
  toCountryId: number;
}

export interface PlanAttraction extends PlanItem {
  type: 'attraction';
  attractionId: number;
  attractionName: string;
  typeOfAttraction: 'UNESCO' | 'National Park' | 'Other';
  countryId: number;
}

export interface PlanAccommodation extends PlanItem {
  type: 'accommodation';
  name: string;
  city: string;
  countryId: number;
}

export interface PlanCarRental extends PlanItem {
  type: 'car_rental';
  company: string;
  pickupLocation: string;
  dropoffLocation: string;
}

export interface PlanFerry extends PlanItem {
  type: 'ferry';
  from: string;
  countryIdFrom: number;
  to: string;
  countryIdTo: number;
}

export interface TrainPlan extends PlanItem {
  type: 'train';
  from: string;
  countryIdFrom: number;
  to: string;
  countryIdTo: number;
}

export type AnyPlanItem =
  | PlanFlight
  | PlanAttraction
  | PlanAccommodation
  | PlanCarRental
  | PlanFerry
  | TrainPlan;
export type PlanItemType = AnyPlanItem['type'];

export interface CreateTripRequest {
  name: string;
  notes?: string;
}

export interface TripResponse {
  id?: number;
  changes?: number;
  message?: string;
  error?: string;
}
