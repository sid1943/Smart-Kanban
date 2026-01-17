// Smart Content Engine - Type Definitions

export type ContentType =
  | 'tv_series'
  | 'movie'
  | 'anime'
  | 'book'
  | 'game'
  | 'music'
  | 'unknown';

export type LensCategory = 'entertainment' | 'leisure' | 'unknown';

export interface DetectionResult {
  type: ContentType;
  category: LensCategory;
  confidence: number;
  signals: string[];
  metadata: {
    title?: string;
    year?: string;
    yearRange?: string;
    author?: string;
    platform?: string;
  };
}

export interface ContentRating {
  source: string;
  score: number | string;
  maxScore?: number;
  url?: string;
  icon?: string;
}

export interface StreamingAvailability {
  service: string;
  type: 'subscription' | 'rent' | 'buy' | 'free';
  price?: string;
  url?: string;
  logo?: string;
}

export interface RelatedContent {
  type: 'sequel' | 'prequel' | 'spinoff' | 'series' | 'similar' | 'by_same_creator';
  title: string;
  year?: string;
  id?: string;
  url?: string;
}

// Entertainment Lens Data
export interface EntertainmentData {
  type: 'tv_series' | 'movie' | 'anime';
  title: string;
  year?: string;
  yearRange?: string;

  // Ratings
  ratings: ContentRating[];

  // Media info
  runtime?: string;
  seasons?: number;
  episodes?: number;
  status?: 'ongoing' | 'ended' | 'upcoming';
  genres?: string[];

  // Where to watch
  streaming?: StreamingAvailability[];

  // Links
  imdbId?: string;
  tmdbId?: string;
  malId?: string;
  links: { name: string; url: string; icon?: string }[];

  // Related
  related?: RelatedContent[];
  franchise?: {
    name: string;
    position?: number;
    total?: number;
    items?: { title: string; year?: string; watched?: boolean }[];
  };

  // Images
  poster?: string;
  backdrop?: string;
}

// Leisure Lens Data (Books, Games, Music)
export interface BookData {
  type: 'book';
  title: string;
  author?: string;
  year?: string;

  ratings: ContentRating[];

  pages?: number;
  isbn?: string;
  genres?: string[];
  series?: {
    name: string;
    position?: number;
    total?: number;
  };

  links: { name: string; url: string; icon?: string }[];
  related?: RelatedContent[];

  cover?: string;
}

export interface GameData {
  type: 'game';
  title: string;
  year?: string;

  ratings: ContentRating[];

  platforms?: string[];
  genres?: string[];
  developer?: string;
  publisher?: string;
  playtime?: string;

  links: { name: string; url: string; icon?: string }[];
  related?: RelatedContent[];

  cover?: string;
}

export interface MusicData {
  type: 'music';
  title: string;
  artist?: string;
  year?: string;

  albumType?: 'album' | 'single' | 'ep';
  tracks?: number;
  duration?: string;
  genres?: string[];

  ratings: ContentRating[];
  links: { name: string; url: string; icon?: string }[];
  related?: RelatedContent[];

  cover?: string;
}

export type EnrichedData = EntertainmentData | BookData | GameData | MusicData | null;

export interface EnrichmentResult {
  success: boolean;
  data: EnrichedData;
  cached?: boolean;
  fetchedAt?: string;
  error?: string;
}

// Lens Configuration
export interface LensConfig {
  id: string;
  name: string;
  icon: string;
  category: LensCategory;
  contentTypes: ContentType[];

  detectPatterns: {
    keywords: string[];
    yearPattern?: RegExp;
    urlPatterns?: RegExp[];
    contextLists?: string[];
    excludeKeywords?: string[];
  };
}
