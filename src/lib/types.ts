export interface WhereToWatch {
  svod: string[];
  vod: string[];
  free: string[];
}

export interface Letterboxd {
  top_positive: string;
  top_negative: string;
}

export interface Movie {
  id: string; // stable canonical film ID from content-engine films.jsonl
  title: string;
  year: number;
  director: string;
  rating: number;
  genres: string[];
  categories: string[];
  dna: string[];
  description: string;
  letterboxd: Letterboxd;
  whereToWatch: WhereToWatch;
  sources: string[];
  tmdbId: string | null;
  // Engine fields (populated by sync-engine)
  scary?: number;
  production?: number;
  extreme?: number;
  paceScore?: number;
  pace?: "fast" | "medium" | "slow";
  whyScary?: string;
  scareType?: string;
  subGenre?: string;
  wave?: string;
  addedDate?: string;
  watchedByRia?: boolean;
  csvStatus?: "ELIGIBLE" | "WATCHED" | "REVIEWED";
  compositeScore?: number;
  defaultVisible?: boolean;
  posterPath?: string;
}

export type Category = string;
