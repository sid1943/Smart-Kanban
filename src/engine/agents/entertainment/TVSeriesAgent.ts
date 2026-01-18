// TV Series Agent - Handles detection and enrichment for TV shows
// APIs: TMDb, OMDb

import { BaseAgent, AgentDetectionResult, DetectionContext } from '../BaseAgent';
import { EnrichedData, EntertainmentData } from '../../types';
import { enrichFromTMDb } from '../../enrichment/tmdb';
import { getOMDbRatings } from '../../enrichment/omdb';

export class TVSeriesAgent extends BaseAgent {
  readonly type = 'tv_series' as const;
  readonly name = 'TV Series Agent';
  readonly category = 'entertainment' as const;
  readonly apis = ['TMDb', 'OMDb'];

  // Strong signals for TV series
  protected keywords = [
    /\b(season|seasons)\s*\d*/i,
    /\b(episode|episodes|ep)\s*\d*/i,
    /\bs\d{1,2}e\d{1,2}\b/i,  // S01E01 format
    /\b(miniseries|mini[_\s]?series|limited[_\s]?series)\b/i,
    /\b(tv\s*show|television|tv\s*series)\b/i,
  ];

  // Weak/context signals
  protected contextKeywords = [
    /\b(netflix|hbo|hulu|disney\+|prime\s*video|streaming)\b/i,
    /\b(binge|marathon|watching|watched)\b/i,
    /\b(pilot|finale|premiere)\b/i,
    /\b(showrunner|creator)\b/i,
  ];

  // URL patterns that indicate TV series
  protected urlPatterns = [
    { pattern: /themoviedb\.org\/tv\/\d+/i, weight: 50 },
    { pattern: /imdb\.com\/title\/tt\d+/i, weight: 35 },
    { pattern: /thetvdb\.com/i, weight: 45 },
    { pattern: /trakt\.tv\/shows/i, weight: 45 },
  ];

  // List context mappings
  protected getListContextMappings(): [string, number][] {
    return [
      ['tv_series', 30],
      ['tv_shows', 30],
      ['series', 25],
      ['shows', 20],
      ['to_watch', 15],
      ['watching', 20],
      ['watched', 15],
      ['finished', 10],
    ];
  }

  // Additional TV-specific detection
  canHandle(context: DetectionContext): AgentDetectionResult {
    const result = super.canHandle(context);

    // Boost confidence if year range found (common for TV series)
    if (result.metadata.yearRange) {
      result.confidence = Math.min(100, result.confidence + 20);
      result.signals.push('Year range detected (TV indicator)');
    }

    // Boost if checklist has season-like names
    if (context.checklistNames) {
      const hasSeasonChecklist = context.checklistNames.some(
        name => /season/i.test(name)
      );
      if (hasSeasonChecklist) {
        result.confidence = Math.min(100, result.confidence + 25);
        result.signals.push('Season checklist found');
      }
    }

    return result;
  }

  // Fetch enriched data for TV series
  async enrich(title: string, year?: string): Promise<EnrichedData> {
    console.log(`[TVSeriesAgent] Enriching: ${title} (${year || 'no year'})`);

    // Get base data from TMDb
    const tmdbData = await enrichFromTMDb(title, 'tv_series', year);
    if (!tmdbData) {
      console.log(`[TVSeriesAgent] No TMDb data found for: ${title}`);
      return null;
    }

    // Enhance with OMDb ratings (IMDb, Rotten Tomatoes, Metacritic)
    const omdbRatings = await getOMDbRatings(
      title,
      'series',
      year,
      tmdbData.imdbId
    );

    // Merge ratings (dedupe by source)
    const allRatings = [...(tmdbData.ratings || [])];
    for (const rating of omdbRatings) {
      if (!allRatings.some(r => r.source === rating.source)) {
        allRatings.push(rating);
      }
    }

    const enrichedData: EntertainmentData = {
      ...tmdbData,
      title: tmdbData.title || title, // Ensure title is always set
      type: 'tv_series',
      ratings: allRatings,
      links: tmdbData.links || [], // Ensure links is always an array
    };

    console.log(`[TVSeriesAgent] Enriched: ${title} with ${allRatings.length} ratings`);
    return enrichedData;
  }
}

export default TVSeriesAgent;
