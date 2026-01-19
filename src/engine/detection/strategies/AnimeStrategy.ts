// Anime New Content Detection Strategy
// Checks for sequels using Jikan API related data and season tracking

import { ContentType, EntertainmentData } from '../../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
} from '../NewContentDetector';

export class AnimeStrategy implements NewContentStrategy {
  readonly supportedTypes: ContentType[] = ['anime'];

  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const { enrichedData, checklists } = context;

    // Must have entertainment data (anime uses same structure as TV)
    if (!enrichedData || (enrichedData.type !== 'anime' && enrichedData.type !== 'tv_series')) {
      return { hasNewContent: false };
    }

    const animeData = enrichedData as EntertainmentData;

    // First check for season-based tracking (like TV series)
    const seasonResult = this.checkSeasons(animeData, checklists);
    if (seasonResult.hasNewContent) {
      return seasonResult;
    }

    // Then check related anime for sequels
    const sequelResult = this.checkRelatedSequels(animeData);
    if (sequelResult.hasNewContent) {
      return sequelResult;
    }

    return {
      hasNewContent: false,
      status: animeData.status,
      debug: { reason: 'No new seasons or sequels found' },
    };
  }

  private checkSeasons(
    animeData: EntertainmentData,
    checklists: { name: string; items: { text: string; checked: boolean }[] }[]
  ): NewContentDetectionResult {
    const apiSeasons = animeData.seasons || 0;
    const trackedSeasons = this.countSeasonsInChecklists(checklists);

    if (trackedSeasons === 0 || apiSeasons <= trackedSeasons) {
      return { hasNewContent: false };
    }

    // Check for upcoming season
    const hasUpcoming = animeData.nextSeason
      ? animeData.nextSeason.seasonNumber > trackedSeasons
      : false;

    return {
      hasNewContent: true,
      upcomingContent: hasUpcoming && animeData.nextSeason
        ? {
            contentKind: 'season',
            title: `Season ${animeData.nextSeason.seasonNumber}`,
            releaseDate: animeData.nextSeason.airDate,
            description: animeData.nextSeason.episodeName,
            source: 'jikan',
            seasonNumber: animeData.nextSeason.seasonNumber,
          }
        : {
            contentKind: 'season',
            title: `Season ${trackedSeasons + 1}`,
            source: 'jikan',
            seasonNumber: trackedSeasons + 1,
          },
      status: animeData.status,
      debug: {
        reason: hasUpcoming ? 'Upcoming season announced' : 'New season available',
        comparison: `API: ${apiSeasons} seasons, Tracked: ${trackedSeasons} seasons`,
      },
    };
  }

  private checkRelatedSequels(animeData: EntertainmentData): NewContentDetectionResult {
    if (!animeData.related || animeData.related.length === 0) {
      return { hasNewContent: false };
    }

    // Look for sequel in related content
    const sequel = animeData.related.find(
      (r) => r.type === 'sequel' || r.type === 'series'
    );

    if (!sequel) {
      return { hasNewContent: false };
    }

    // Check if sequel is future release
    const sequelYear = parseInt(sequel.year || '0', 10);
    const isUpcoming = sequelYear > new Date().getFullYear();

    return {
      hasNewContent: true,
      upcomingContent: {
        contentKind: 'sequel',
        title: sequel.title,
        releaseDate: sequel.year ? `${sequel.year}-01-01` : undefined,
        source: 'jikan',
      },
      status: animeData.status,
      debug: {
        reason: isUpcoming ? 'Sequel announced' : 'Sequel available',
        comparison: sequel.title,
      },
    };
  }

  private countSeasonsInChecklists(
    checklists: { name: string; items: { text: string; checked: boolean }[] }[]
  ): number {
    let maxSeason = 0;

    for (const checklist of checklists) {
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
