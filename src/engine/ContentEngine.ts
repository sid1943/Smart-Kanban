// Smart Content Engine - Main Entry Point
// Detects content type and enriches with relevant data

import {
  ContentType,
  DetectionResult,
  EnrichedData,
  EnrichmentResult,
  EntertainmentData,
  BookData,
  GameData,
} from './types';

import {
  detectContent,
  getContentTypeIcon,
  getContentTypeName,
} from './detection/ContentDetector';

import { enrichFromTMDb } from './enrichment/tmdb';
import { getOMDbRatings } from './enrichment/omdb';
import { enrichFromJikan } from './enrichment/jikan';
import { enrichFromOpenLibrary, getBooksByAuthor } from './enrichment/openLibrary';
import { enrichFromRAWG } from './enrichment/rawg';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: EnrichedData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCacheKey(title: string, type: ContentType): string {
  return `${type}:${title.toLowerCase().trim()}`;
}

function getFromCache(key: string): EnrichedData | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: EnrichedData): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Main detection function
export function detect(
  text: string,
  listContext?: string,
  urls?: string[]
): DetectionResult {
  return detectContent(text, listContext, urls);
}

// Main enrichment function - fetches data based on detected type
export async function enrich(
  text: string,
  detectedType?: ContentType,
  listContext?: string,
  urls?: string[]
): Promise<EnrichmentResult> {
  try {
    // Detect content type if not provided
    const detection = detectedType
      ? { type: detectedType, metadata: { title: text } } as DetectionResult
      : detect(text, listContext, urls);

    const { type, metadata } = detection;
    const title = metadata.title || text;

    console.log('Content Engine enriching:', { type, title, metadata });

    // Check cache first
    const cacheKey = getCacheKey(title, type);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        cached: true,
        fetchedAt: new Date().toISOString(),
      };
    }

    let data: EnrichedData = null;

    // Enrich based on content type
    switch (type) {
      case 'tv_series':
        data = await enrichTVSeries(title, metadata.yearRange || metadata.year);
        break;

      case 'movie':
        data = await enrichMovie(title, metadata.year);
        break;

      case 'anime':
        data = await enrichAnime(title);
        break;

      case 'book':
        data = await enrichBook(title, metadata.author);
        break;

      case 'game':
        data = await enrichGame(title);
        break;

      default:
        return {
          success: false,
          data: null,
          error: `Unknown content type: ${type}`,
        };
    }

    if (data) {
      setCache(cacheKey, data);
      return {
        success: true,
        data,
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      data: null,
      error: 'No data found for this content',
    };
  } catch (error) {
    console.error('Enrichment error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Entertainment enrichment functions
async function enrichTVSeries(
  title: string,
  year?: string
): Promise<EntertainmentData | null> {
  // Get base data from TMDb
  const tmdbData = await enrichFromTMDb(title, 'tv_series', year?.split(' ')[0]);
  if (!tmdbData) return null;

  // Enhance with OMDb ratings (IMDb, Rotten Tomatoes, Metacritic)
  const omdbRatings = await getOMDbRatings(
    title,
    'series',
    year?.split(' ')[0],
    tmdbData.imdbId
  );

  // Merge ratings (dedupe by source)
  const allRatings = [...(tmdbData.ratings || [])];
  for (const rating of omdbRatings) {
    if (!allRatings.some(r => r.source === rating.source)) {
      allRatings.push(rating);
    }
  }

  return {
    ...tmdbData,
    ratings: allRatings,
  } as EntertainmentData;
}

async function enrichMovie(
  title: string,
  year?: string
): Promise<EntertainmentData | null> {
  // Get base data from TMDb
  const tmdbData = await enrichFromTMDb(title, 'movie', year);
  if (!tmdbData) return null;

  // Enhance with OMDb ratings
  const omdbRatings = await getOMDbRatings(title, 'movie', year, tmdbData.imdbId);

  // Merge ratings
  const allRatings = [...(tmdbData.ratings || [])];
  for (const rating of omdbRatings) {
    if (!allRatings.some(r => r.source === rating.source)) {
      allRatings.push(rating);
    }
  }

  return {
    ...tmdbData,
    ratings: allRatings,
  } as EntertainmentData;
}

async function enrichAnime(title: string): Promise<EntertainmentData | null> {
  const jikanData = await enrichFromJikan(title);
  if (!jikanData) return null;

  return jikanData as EntertainmentData;
}

// Leisure enrichment functions
async function enrichBook(
  title: string,
  author?: string
): Promise<BookData | null> {
  const bookData = await enrichFromOpenLibrary(title, author);
  if (!bookData) return null;

  // Get related books by same author
  if (bookData.author) {
    const related = await getBooksByAuthor(bookData.author, bookData.title);
    if (related.length > 0) {
      bookData.related = related;
    }
  }

  return bookData as BookData;
}

async function enrichGame(title: string): Promise<GameData | null> {
  const gameData = await enrichFromRAWG(title);
  if (!gameData) return null;

  return gameData as GameData;
}

// Export utility functions
export { getContentTypeIcon, getContentTypeName };

// Export types
export type {
  ContentType,
  DetectionResult,
  EnrichedData,
  EnrichmentResult,
  EntertainmentData,
  BookData,
  GameData,
};
