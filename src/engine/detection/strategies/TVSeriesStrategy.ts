// TV Series New Content Detection Strategy
// Compares user's tracked seasons against TMDb API data

import { ContentType, EntertainmentData } from '../../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
  isUpcoming,
} from '../NewContentDetector';

export class TVSeriesStrategy implements NewContentStrategy {
  readonly supportedTypes: ContentType[] = ['tv_series'];

  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const { enrichedData, checklists } = context;

    // Must have TV series data
    if (!enrichedData || enrichedData.type !== 'tv_series') {
      return { hasNewContent: false };
    }

    const tvData = enrichedData as EntertainmentData;
    const apiSeasons = tvData.seasons || 0;

    // Count seasons in user's checklists
    const trackedSeasons = this.countSeasonsInChecklists(checklists);

    if (trackedSeasons === 0) {
      // No seasons tracked yet, can't determine new content
      return { hasNewContent: false };
    }

    // Check for released seasons the user hasn't tracked
    const hasNewReleased = apiSeasons > trackedSeasons;

    // Check for upcoming seasons (announced but not yet released)
    const hasUpcomingSeason = tvData.nextSeason
      ? tvData.nextSeason.seasonNumber > trackedSeasons
      : false;

    const hasNew = hasNewReleased || hasUpcomingSeason;

    if (!hasNew) {
      return {
        hasNewContent: false,
        status: tvData.status,
        debug: {
          reason: 'No new seasons',
          comparison: `API: ${apiSeasons} seasons, Tracked: ${trackedSeasons} seasons`,
        },
      };
    }

    // Build upcoming content info
    const upcomingContent = tvData.nextSeason && hasUpcomingSeason
      ? {
          contentKind: 'season' as const,
          title: `Season ${tvData.nextSeason.seasonNumber}`,
          releaseDate: tvData.nextSeason.airDate,
          description: tvData.nextSeason.episodeName,
          source: 'tmdb' as const,
          seasonNumber: tvData.nextSeason.seasonNumber,
        }
      : hasNewReleased
        ? {
            contentKind: 'season' as const,
            title: `Season ${trackedSeasons + 1}`,
            source: 'tmdb' as const,
            seasonNumber: trackedSeasons + 1,
          }
        : undefined;

    return {
      hasNewContent: true,
      upcomingContent,
      status: tvData.status,
      debug: {
        reason: hasUpcomingSeason ? 'Upcoming season announced' : 'New season released',
        comparison: `API: ${apiSeasons} seasons, Tracked: ${trackedSeasons} seasons`,
      },
    };
  }

  private countSeasonsInChecklists(
    checklists: { name: string; items: { text: string; checked: boolean }[] }[]
  ): number {
    let maxSeason = 0;

    for (const checklist of checklists) {
      // Check if this is a season checklist
      const isSeasonChecklist =
        checklist.name.toLowerCase().includes('season') ||
        checklist.items.some((item) => /season\s*\d+/i.test(item.text));

      if (isSeasonChecklist) {
        for (const item of checklist.items) {
          const match = item.text.match(/season\s*(\d+)/i);
          if (match) {
            const num = parseInt(match[1], 10);
            if (num > maxSeason) maxSeason = num;
          }
        }
      }
    }

    return maxSeason;
  }
}
