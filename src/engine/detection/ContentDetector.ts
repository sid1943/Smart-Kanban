// Smart Content Engine - Content Detector
// Analyzes input and determines content type with confidence scoring

import { ContentType, LensCategory, DetectionResult } from '../types';

interface DetectionSignal {
  type: ContentType;
  weight: number;
  reason: string;
}

// Patterns for detection
const PATTERNS = {
  // Year patterns
  yearRange: /\b(19|20)\d{2}\s*[-–—]\s*(19|20)?\d{2,4}\b/,
  singleYear: /\b(19|20)\d{2}\b/,

  // TV Series signals
  tvKeywords: /\b(season|seasons|episode|episodes|series|tv\s*show|miniseries|mini[_\s]?series|limited[_\s]?series|s\d{1,2}e\d{1,2})\b/i,
  tvContext: /\b(to[_\s]?watch|watching|watched|binge|netflix|hbo|streaming|tv|shows?)\b/i,

  // Movie signals
  movieKeywords: /\b(movie|film|cinema|theatrical|director'?s\s*cut|extended\s*edition)\b/i,
  movieRuntime: /\b\d{1,3}\s*(min|mins|minutes|hr|hrs|hours)\b/i,

  // Anime signals
  animeKeywords: /\b(anime|manga|ova|ona|sub|dub|crunchyroll|funimation|myanimelist|mal)\b/i,
  animePatterns: /\b(shonen|shounen|shojo|shoujo|seinen|isekai|mecha)\b/i,

  // Book signals
  bookKeywords: /\b(book|novel|author|read|reading|pages?|chapter|isbn|kindle|audiobook|paperback|hardcover)\b/i,
  bookAuthor: /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,

  // Game signals
  gameKeywords: /\b(game|gaming|playstation|ps[45]|xbox|nintendo|switch|steam|pc\s*game|dlc|multiplayer|rpg|fps)\b/i,
  gamePlatforms: /\b(ps[45]|xbox|switch|pc|steam|epic\s*games|gog)\b/i,

  // Music signals
  musicKeywords: /\b(album|song|track|artist|band|music|spotify|vinyl|ep\b|single|discography)\b/i,

  // URL patterns
  imdbUrl: /imdb\.com\/title\/(tt\d+)/i,
  tmdbUrl: /themoviedb\.org\/(movie|tv)\/(\d+)/i,
  malUrl: /myanimelist\.net\/anime\/(\d+)/i,
  goodreadsUrl: /goodreads\.com\/book\/show\/(\d+)/i,
  steamUrl: /store\.steampowered\.com\/app\/(\d+)/i,
  spotifyUrl: /open\.spotify\.com\/(album|track|artist)\/([a-zA-Z0-9]+)/i,
};

// List context mapping
const LIST_CONTEXT: Record<string, ContentType[]> = {
  'to_watch': ['tv_series', 'movie', 'anime'],
  'watching': ['tv_series', 'anime'],
  'watched': ['tv_series', 'movie', 'anime'],
  'movies': ['movie'],
  'films': ['movie'],
  'tv': ['tv_series'],
  'tv_series': ['tv_series'],
  'tv_shows': ['tv_series'],
  'shows': ['tv_series'],
  'series': ['tv_series'],
  'limited_series': ['tv_series'],
  'miniseries': ['tv_series'],
  'anime': ['anime'],
  'books': ['book'],
  'reading': ['book'],
  'to_read': ['book'],
  'games': ['game'],
  'playing': ['game'],
  'backlog': ['game'],
  'music': ['music'],
  'albums': ['music'],
  'listening': ['music'],
};

export function detectContent(
  text: string,
  listContext?: string,
  urls?: string[]
): DetectionResult {
  const signals: DetectionSignal[] = [];
  const metadata: DetectionResult['metadata'] = {};

  // Normalize text
  const normalizedText = text.toLowerCase();
  const normalizedList = listContext?.toLowerCase().replace(/[\s_-]+/g, '_');

  // Extract metadata
  const yearRangeMatch = text.match(PATTERNS.yearRange);
  const singleYearMatch = text.match(PATTERNS.singleYear);

  if (yearRangeMatch) {
    metadata.yearRange = yearRangeMatch[0];
    // Year range strongly suggests TV series or anime
    signals.push({ type: 'tv_series', weight: 20, reason: 'Year range detected' });
    signals.push({ type: 'anime', weight: 15, reason: 'Year range detected' });
  } else if (singleYearMatch) {
    metadata.year = singleYearMatch[0];
  }

  // Check URL patterns
  if (urls && urls.length > 0) {
    for (const url of urls) {
      const imdbMatch = url.match(PATTERNS.imdbUrl);
      if (imdbMatch) {
        signals.push({ type: 'movie', weight: 40, reason: 'IMDb URL found' });
        signals.push({ type: 'tv_series', weight: 35, reason: 'IMDb URL found' });
      }

      const tmdbMatch = url.match(PATTERNS.tmdbUrl);
      if (tmdbMatch) {
        if (tmdbMatch[1] === 'tv') {
          signals.push({ type: 'tv_series', weight: 50, reason: 'TMDb TV URL found' });
        } else {
          signals.push({ type: 'movie', weight: 50, reason: 'TMDb Movie URL found' });
        }
      }

      const malMatch = url.match(PATTERNS.malUrl);
      if (malMatch) {
        signals.push({ type: 'anime', weight: 60, reason: 'MyAnimeList URL found' });
      }

      const goodreadsMatch = url.match(PATTERNS.goodreadsUrl);
      if (goodreadsMatch) {
        signals.push({ type: 'book', weight: 60, reason: 'Goodreads URL found' });
      }

      const steamMatch = url.match(PATTERNS.steamUrl);
      if (steamMatch) {
        signals.push({ type: 'game', weight: 60, reason: 'Steam URL found' });
      }

      const spotifyMatch = url.match(PATTERNS.spotifyUrl);
      if (spotifyMatch) {
        signals.push({ type: 'music', weight: 60, reason: 'Spotify URL found' });
      }
    }
  }

  // Check list context
  if (normalizedList && LIST_CONTEXT[normalizedList]) {
    for (const type of LIST_CONTEXT[normalizedList]) {
      signals.push({ type, weight: 25, reason: `List context: ${listContext}` });
    }
  }

  // Check keyword patterns
  if (PATTERNS.animeKeywords.test(text) || PATTERNS.animePatterns.test(text)) {
    signals.push({ type: 'anime', weight: 35, reason: 'Anime keywords detected' });
  }

  if (PATTERNS.tvKeywords.test(text)) {
    signals.push({ type: 'tv_series', weight: 30, reason: 'TV keywords detected' });
  }

  if (PATTERNS.tvContext.test(text)) {
    signals.push({ type: 'tv_series', weight: 15, reason: 'TV context detected' });
    signals.push({ type: 'movie', weight: 10, reason: 'Watch context detected' });
  }

  if (PATTERNS.movieKeywords.test(text)) {
    signals.push({ type: 'movie', weight: 30, reason: 'Movie keywords detected' });
  }

  if (PATTERNS.movieRuntime.test(text)) {
    signals.push({ type: 'movie', weight: 20, reason: 'Runtime detected' });
  }

  if (PATTERNS.bookKeywords.test(text) || PATTERNS.bookAuthor.test(text)) {
    signals.push({ type: 'book', weight: 35, reason: 'Book keywords detected' });

    // Extract author if present
    const authorMatch = text.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (authorMatch) {
      metadata.author = authorMatch[1];
    }
  }

  if (PATTERNS.gameKeywords.test(text) || PATTERNS.gamePlatforms.test(text)) {
    signals.push({ type: 'game', weight: 35, reason: 'Game keywords detected' });
  }

  if (PATTERNS.musicKeywords.test(text)) {
    signals.push({ type: 'music', weight: 35, reason: 'Music keywords detected' });
  }

  // Calculate scores for each type
  const scores: Record<ContentType, { score: number; signals: string[] }> = {
    tv_series: { score: 0, signals: [] },
    movie: { score: 0, signals: [] },
    anime: { score: 0, signals: [] },
    book: { score: 0, signals: [] },
    game: { score: 0, signals: [] },
    music: { score: 0, signals: [] },
    unknown: { score: 0, signals: [] },
  };

  for (const signal of signals) {
    scores[signal.type].score += signal.weight;
    scores[signal.type].signals.push(signal.reason);
  }

  // Find the best match
  let bestType: ContentType = 'unknown';
  let bestScore = 0;

  for (const [type, data] of Object.entries(scores)) {
    if (data.score > bestScore && type !== 'unknown') {
      bestScore = data.score;
      bestType = type as ContentType;
    }
  }

  // Calculate confidence (0-100)
  const maxPossibleScore = 100;
  const confidence = Math.min(100, Math.round((bestScore / maxPossibleScore) * 100));

  // Determine category
  let category: LensCategory = 'unknown';
  if (['tv_series', 'movie', 'anime'].includes(bestType)) {
    category = 'entertainment';
  } else if (['book', 'game', 'music'].includes(bestType)) {
    category = 'leisure';
  }

  // Extract clean title (remove year, keywords, etc.)
  let title = text
    .replace(/\s*\(\s*(19|20)\d{2}\s*[-–—]?\s*((19|20)?\d{2,4}|present)?\s*\)/gi, '') // Remove (2008) or (2008-2013)
    .replace(PATTERNS.yearRange, '')
    .replace(/\s*[-–—]\s*(19|20)\d{2}\s*$/g, '') // Remove trailing " - 2008"
    .replace(/\s*[-–—]\s*$/, '')
    .replace(/^\s*[-–—]\s*/, '')
    .trim();

  metadata.title = title || text;
  console.log('Content Detector - original:', text, 'cleaned:', title);

  return {
    type: bestType,
    category,
    confidence,
    signals: scores[bestType]?.signals || [],
    metadata,
  };
}

// Quick type check helpers
export function isEntertainment(type: ContentType): boolean {
  return ['tv_series', 'movie', 'anime'].includes(type);
}

export function isLeisure(type: ContentType): boolean {
  return ['book', 'game', 'music'].includes(type);
}

// Get icon for content type
export function getContentTypeIcon(type: ContentType): string {
  const icons: Record<ContentType, string> = {
    tv_series: '📺',
    movie: '🎬',
    anime: '🎌',
    book: '📚',
    game: '🎮',
    music: '🎵',
    unknown: '📄',
  };
  return icons[type] || '📄';
}

// Get display name for content type
export function getContentTypeName(type: ContentType): string {
  const names: Record<ContentType, string> = {
    tv_series: 'TV Series',
    movie: 'Movie',
    anime: 'Anime',
    book: 'Book',
    game: 'Game',
    music: 'Music',
    unknown: 'Unknown',
  };
  return names[type] || 'Unknown';
}
