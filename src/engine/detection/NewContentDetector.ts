// New Content Detection - Base Interfaces
// Defines the contract for content-type-specific detection strategies

import { ContentType, EnrichedData, UpcomingContent, UpcomingContentKind } from '../types';

// Checklist data for comparison
export interface ChecklistInfo {
  name: string;
  items: { text: string; checked: boolean }[];
}

// Context passed to detection strategies
export interface NewContentDetectionContext {
  taskId: string;
  title: string;
  contentType: ContentType;
  enrichedData: EnrichedData;
  checklists: ChecklistInfo[];
  currentProgress?: {
    seasonsTracked?: number;
    booksRead?: number;
    gamesPlayed?: string[];
  };
}

// Result from a detection strategy
export interface NewContentDetectionResult {
  hasNewContent: boolean;
  upcomingContent?: UpcomingContent;
  status?: 'ongoing' | 'ended' | 'upcoming';
  debug?: {
    reason: string;
    comparison?: string;
  };
}

// Interface for content-type-specific detection strategies
export interface NewContentStrategy {
  // Content types this strategy handles
  readonly supportedTypes: ContentType[];

  // Detect new content based on enriched data and user's current progress
  detect(context: NewContentDetectionContext): NewContentDetectionResult;
}

// Helper to get display label for a content kind
export function getContentKindLabel(kind: UpcomingContentKind): string {
  switch (kind) {
    case 'season':
      return 'NEW SEASON';
    case 'sequel':
      return 'SEQUEL';
    case 'book':
      return 'NEW BOOK';
    case 'dlc':
      return 'DLC';
    case 'related':
      return 'NEW RELEASE';
    case 'episode':
      return 'NEW EPISODE';
    default:
      return 'NEW';
  }
}

// Helper to check if content is "upcoming" (future release date)
export function isUpcoming(releaseDate?: string): boolean {
  if (!releaseDate) return false;
  try {
    const date = new Date(releaseDate);
    return date > new Date();
  } catch {
    return false;
  }
}
