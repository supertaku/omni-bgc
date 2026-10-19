/** Research evidence is deliberately separate from canonical Citation/approval. */
export type FoodPriceEvidence =
  'estimated' | 'published-menu' | 'published-starting' | 'published-research';
export type FoodHours = {
  text: string | null;
  kind: 'restaurant' | 'delivery' | 'ordering' | 'unknown';
  evidence: string;
  sourceUrl: string | null;
  venueText: string | null;
  venueSourceUrl: string | null;
  weeklySchedule: { day: number; start: string; end: string }[] | null;
};
export type FoodMenuItem = {
  id: string;
  restaurantId: string;
  origin: 'research';
  name: string;
  section: string | null;
  category: string | null;
  tags: string[];
  description: string | null;
  amount: string;
  currency: 'PHP';
  priceEvidence: FoodPriceEvidence;
  priceSourceUrl: string | null;
  estimationBasis: string | null;
  menuSourceUrl: string | null;
  branch: string | null;
  researchStatus: string;
  researchDate: string;
};
export type FoodRestaurant = {
  id: string;
  externalId: string;
  origin: 'research';
  name: string;
  type: string;
  zone: string | null;
  building: string | null;
  floor: string | null;
  locationOriginal: string | null;
  locationSpecificity: string | null;
  hours: FoodHours;
  menuStatus: string;
  menuBranch: string | null;
  locationSourceUrl: string | null;
  notes: string | null;
  researchDate: string | null;
  items: FoodMenuItem[];
};
export type FoodFilters = {
  query?: string;
  restaurantId?: string;
  category?: string;
  building?: string;
  floor?: string;
  zone?: string;
  type?: string;
  minPhp?: string;
  maxPhp?: string;
  limit?: number;
};
export type FoodEvidence = {
  origin: 'research';
  entityId: string;
  researchDate: string | null;
  urls: string[];
  status: string;
  priceEvidence?: FoodPriceEvidence;
  estimationBasis?: string | null;
  branch?: string | null;
  hours?: FoodHours;
  rightsReview: 'pending';
};
