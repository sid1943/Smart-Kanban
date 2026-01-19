// Movie New Content Detection Strategy
// Checks for sequels in a franchise the user is tracking

import { ContentType, EntertainmentData } from '../../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
  isUpcoming,
} from '../NewContentDetector';

export class MovieStrategy implements NewContentStrategy {
  readonly supportedTypes: ContentType[] = ['movie'];

  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const { enrichedData, title } = context;

    // Must have movie data
    if (!enrichedData || enrichedData.type !== 'movie') {
      return { hasNewContent: false };
    }

    const movieData = enrichedData as EntertainmentData;

    // Check if movie is part of a franchise
    if (!movieData.franchise || !movieData.franchise.items) {
      return {
        hasNewContent: false,
        debug: { reason: 'Not part of a franchise' },
      };
    }

    const franchise = movieData.franchise;
    const currentPosition = franchise.position || 0;
    const totalInFranchise = franchise.total || 0;

    // No new content if this is the latest or we don't know position
    if (currentPosition === 0 || currentPosition >= totalInFranchise) {
      return {
        hasNewContent: false,
        debug: {
          reason: 'Current movie is latest in franchise',
          comparison: `Position ${currentPosition} of ${totalInFranchise}`,
        },
      };
    }

    // Find the next movie in the franchise
    const nextMovie = franchise.items?.find((item, index) => {
      // Items are usually ordered by release date
      const itemYear = parseInt(item.year || '0', 10);
      const currentYear = parseInt(movieData.year || '0', 10);
      return itemYear > currentYear;
    });

    if (!nextMovie) {
      return {
        hasNewContent: false,
        debug: {
          reason: 'No sequel found in franchise',
          comparison: `Position ${currentPosition} of ${totalInFranchise}`,
        },
      };
    }

    // Check if the sequel is upcoming (future release)
    const isUpcomingRelease = nextMovie.year
      ? parseInt(nextMovie.year, 10) > new Date().getFullYear()
      : false;

    return {
      hasNewContent: true,
      upcomingContent: {
        contentKind: 'sequel',
        title: nextMovie.title,
        releaseDate: nextMovie.year ? `${nextMovie.year}-01-01` : undefined,
        source: 'tmdb',
        seriesPosition: currentPosition + 1,
      },
      debug: {
        reason: isUpcomingRelease ? 'Sequel upcoming' : 'Sequel available',
        comparison: `${nextMovie.title} (${nextMovie.year})`,
      },
    };
  }
}
