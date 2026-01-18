// Movie Agent - Handles detection and enrichment for films
// APIs: TMDb, OMDb

import { BaseAgent, AgentDetectionResult, DetectionContext } from '../BaseAgent';
import { EnrichedData, EntertainmentData } from '../../types';
import { enrichFromTMDb } from '../../enrichment/tmdb';
import { getOMDbRatings } from '../../enrichment/omdb';

export class MovieAgent extends BaseAgent {
  readonly type = 'movie' as const;
  readonly name = 'Movie Agent';
  readonly category = 'entertainment' as const;
  readonly apis = ['TMDb', 'OMDb'];

  // Strong signals for movies
  protected keywords = [
    /\b(movie|film|cinema|theatrical)\b/i,
    /\b(director'?s\s*cut|extended\s*edition|unrated)\b/i,
    /\b(box\s*office|blockbuster)\b/i,
    /\b(sequel|prequel|trilogy|franchise)\b/i,
  ];

  // Weak/context signals
  protected contextKeywords = [
    /\b(theater|theatre|imax|3d)\b/i,
    /\b(oscar|academy\s*award|golden\s*globe)\b/i,
    /\b(blu-?ray|dvd|4k)\b/i,
    /\b(runtime|duration)\b/i,
    /\b\d{1,3}\s*(min|mins|minutes|hr|hrs|hours)\b/i, // Runtime pattern
  ];

  // URL patterns that indicate movies
  protected urlPatterns = [
    { pattern: /themoviedb\.org\/movie\/\d+/i, weight: 50 },
    { pattern: /imdb\.com\/title\/tt\d+/i, weight: 40 },
    { pattern: /rottentomatoes\.com\/m\//i, weight: 45 },
    { pattern: /letterboxd\.com\/film\//i, weight: 50 },
  ];

  // List context mappings
  protected getListContextMappings(): [string, number][] {
    return [
      ['movies', 30],
      ['films', 30],
      ['cinema', 25],
      ['to_watch', 10],
      ['watched', 10],
    ];
  }

  // Additional movie-specific detection
  canHandle(context: DetectionContext): AgentDetectionResult {
    const result = super.canHandle(context);

    // Single year (not range) slightly favors movies over TV
    if (result.metadata.year && !result.metadata.yearRange) {
      result.confidence = Math.min(100, result.confidence + 10);
      result.signals.push('Single year (movie indicator)');
    }

    // Check for runtime pattern in description
    if (context.description) {
      const runtimeMatch = context.description.match(/\b(\d{1,3})\s*(min|minutes|hrs?|hours)\b/i);
      if (runtimeMatch) {
        const mins = parseInt(runtimeMatch[1]);
        // Typical movie runtime: 80-200 minutes
        if (mins >= 80 && mins <= 200) {
          result.confidence = Math.min(100, result.confidence + 20);
          result.signals.push(`Runtime detected: ${runtimeMatch[0]}`);
        }
      }
    }

    return result;
  }

  // Fetch enriched data for movies
  async enrich(title: string, year?: string): Promise<EnrichedData> {
    console.log(`[MovieAgent] Enriching: ${title} (${year || 'no year'})`);

    // Get base data from TMDb
    const tmdbData = await enrichFromTMDb(title, 'movie', year);
    if (!tmdbData) {
      console.log(`[MovieAgent] No TMDb data found for: ${title}`);
      return null;
    }

    // Enhance with OMDb ratings
    const omdbRatings = await getOMDbRatings(title, 'movie', year, tmdbData.imdbId);

    // Merge ratings
    const allRatings = [...(tmdbData.ratings || [])];
    for (const rating of omdbRatings) {
      if (!allRatings.some(r => r.source === rating.source)) {
        allRatings.push(rating);
      }
    }

    const enrichedData: EntertainmentData = {
      ...tmdbData,
      title: tmdbData.title || title, // Ensure title is always set
      type: 'movie',
      ratings: allRatings,
      links: tmdbData.links || [], // Ensure links is always an array
    };

    console.log(`[MovieAgent] Enriched: ${title} with ${allRatings.length} ratings`);
    return enrichedData;
  }
}

export default MovieAgent;
