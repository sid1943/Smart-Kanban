// Jikan API Client - Anime (MyAnimeList data)
// Free API: https://jikan.moe/ (No API key required, rate limited)

import { EntertainmentData, ContentRating, RelatedContent } from '../types';

const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

interface JikanAnime {
  mal_id: number;
  url: string;
  images: {
    jpg: { image_url: string; large_image_url: string };
  };
  title: string;
  title_english?: string;
  title_japanese?: string;
  type: string;
  episodes?: number;
  status: string;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  synopsis?: string;
  year?: number;
  season?: string;
  studios?: { mal_id: number; name: string }[];
  genres?: { mal_id: number; name: string }[];
  aired?: {
    from: string;
    to?: string;
  };
  duration?: string;
  rating?: string;
}

interface JikanSearchResult {
  data: JikanAnime[];
}

interface JikanRelations {
  data: {
    relation: string;
    entry: { mal_id: number; type: string; name: string; url: string }[];
  }[];
}

// Rate limiting helper (Jikan has 3 requests/second limit)
let lastRequestTime = 0;
async function rateLimitedFetch(url: string): Promise<Response | null> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < 350) {
    await new Promise(resolve => setTimeout(resolve, 350 - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();

  try {
    return await fetch(url);
  } catch (error) {
    console.error('Jikan fetch error:', error);
    return null;
  }
}

export async function searchJikan(query: string): Promise<JikanAnime | null> {
  try {
    const params = new URLSearchParams({
      q: query,
      limit: '1',
      sfw: 'true',
    });

    const response = await rateLimitedFetch(`${JIKAN_BASE_URL}/anime?${params}`);
    if (!response || !response.ok) return null;

    const data: JikanSearchResult = await response.json();
    return data.data?.[0] || null;
  } catch (error) {
    console.error('Jikan search error:', error);
    return null;
  }
}

export async function getJikanById(malId: number): Promise<JikanAnime | null> {
  try {
    const response = await rateLimitedFetch(`${JIKAN_BASE_URL}/anime/${malId}`);
    if (!response || !response.ok) return null;

    const data = await response.json();
    return data.data || null;
  } catch (error) {
    console.error('Jikan fetch error:', error);
    return null;
  }
}

export async function getJikanRelations(malId: number): Promise<RelatedContent[]> {
  try {
    const response = await rateLimitedFetch(`${JIKAN_BASE_URL}/anime/${malId}/relations`);
    if (!response || !response.ok) return [];

    const data: JikanRelations = await response.json();
    const related: RelatedContent[] = [];

    for (const relation of data.data || []) {
      let relationType: RelatedContent['type'] | null = null;

      switch (relation.relation.toLowerCase()) {
        case 'sequel':
          relationType = 'sequel';
          break;
        case 'prequel':
          relationType = 'prequel';
          break;
        case 'spin-off':
        case 'side story':
          relationType = 'spinoff';
          break;
        case 'parent story':
        case 'alternative version':
          relationType = 'series';
          break;
      }

      if (relationType) {
        for (const entry of relation.entry) {
          if (entry.type === 'anime') {
            related.push({
              type: relationType,
              title: entry.name,
              url: entry.url,
              id: String(entry.mal_id),
            });
          }
        }
      }
    }

    return related.slice(0, 5);
  } catch (error) {
    console.error('Jikan relations error:', error);
    return [];
  }
}

export async function enrichFromJikan(
  title: string,
  malId?: number
): Promise<Partial<EntertainmentData> | null> {
  let anime: JikanAnime | null = null;

  if (malId) {
    anime = await getJikanById(malId);
  } else {
    anime = await searchJikan(title);
  }

  if (!anime) return null;

  // Get related anime
  const related = await getJikanRelations(anime.mal_id);

  // Build ratings
  const ratings: ContentRating[] = [];
  if (anime.score) {
    ratings.push({
      source: 'MyAnimeList',
      score: anime.score,
      maxScore: 10,
      icon: '🎌',
      url: anime.url,
    });
  }

  // Build year range
  let yearRange: string | undefined;
  if (anime.aired?.from) {
    const startYear = anime.aired.from.split('-')[0];
    const endYear = anime.aired.to?.split('-')[0];
    yearRange = endYear && endYear !== startYear
      ? `${startYear} - ${endYear}`
      : startYear;
  } else if (anime.year) {
    yearRange = String(anime.year);
  }

  // Determine status
  let status: 'ongoing' | 'ended' | 'upcoming' | undefined;
  switch (anime.status?.toLowerCase()) {
    case 'finished airing':
      status = 'ended';
      break;
    case 'currently airing':
      status = 'ongoing';
      break;
    case 'not yet aired':
      status = 'upcoming';
      break;
  }

  // Build links
  const links = [
    {
      name: 'MyAnimeList',
      url: anime.url,
      icon: '🎌',
    },
    {
      name: 'Crunchyroll',
      url: `https://www.crunchyroll.com/search?q=${encodeURIComponent(anime.title_english || anime.title)}`,
      icon: '🍥',
    },
  ];

  return {
    type: 'anime',
    title: anime.title_english || anime.title,
    yearRange,
    ratings,
    episodes: anime.episodes,
    status,
    genres: anime.genres?.map(g => g.name),
    malId: String(anime.mal_id),
    links,
    related: related.length > 0 ? related : undefined,
    poster: anime.images.jpg.large_image_url || anime.images.jpg.image_url,
  };
}
