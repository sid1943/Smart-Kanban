// OMDb API Client - Movies & TV Shows
// Free API: https://www.omdbapi.com/ (1000 requests/day)
// Great for: IMDb ratings, Rotten Tomatoes, Metacritic

import { ContentRating } from '../types';

// OMDb API key - Free tier (1000 requests/day)
// Get your own key at https://www.omdbapi.com/apikey.aspx
const OMDB_API_KEY = import.meta.env.VITE_OMDB_API_KEY || '550267c4';
const OMDB_BASE_URL = 'https://www.omdbapi.com/';

interface OMDbResponse {
  Response: 'True' | 'False';
  Error?: string;
  Title?: string;
  Year?: string;
  Rated?: string;
  Released?: string;
  Runtime?: string;
  Genre?: string;
  Director?: string;
  Actors?: string;
  Plot?: string;
  Poster?: string;
  Ratings?: { Source: string; Value: string }[];
  imdbRating?: string;
  imdbVotes?: string;
  imdbID?: string;
  Type?: 'movie' | 'series' | 'episode';
  totalSeasons?: string;
  BoxOffice?: string;
}

export async function searchOMDb(
  title: string,
  type?: 'movie' | 'series',
  year?: string
): Promise<OMDbResponse | null> {
  if (!OMDB_API_KEY) {
    console.warn('OMDb API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      t: title,
      plot: 'short',
    });

    if (type) params.append('type', type);
    if (year) params.append('y', year);

    const response = await fetch(`${OMDB_BASE_URL}?${params}`);
    if (!response.ok) return null;

    const data: OMDbResponse = await response.json();
    if (data.Response === 'False') return null;

    return data;
  } catch (error) {
    console.error('OMDb search error:', error);
    return null;
  }
}

export async function getOMDbByImdbId(imdbId: string): Promise<OMDbResponse | null> {
  if (!OMDB_API_KEY) return null;

  try {
    const params = new URLSearchParams({
      apikey: OMDB_API_KEY,
      i: imdbId,
      plot: 'short',
    });

    const response = await fetch(`${OMDB_BASE_URL}?${params}`);
    if (!response.ok) return null;

    const data: OMDbResponse = await response.json();
    if (data.Response === 'False') return null;

    return data;
  } catch (error) {
    console.error('OMDb fetch error:', error);
    return null;
  }
}

// Extract ratings from OMDb response
export function extractOMDbRatings(data: OMDbResponse): ContentRating[] {
  const ratings: ContentRating[] = [];

  // IMDb Rating
  if (data.imdbRating && data.imdbRating !== 'N/A') {
    ratings.push({
      source: 'IMDb',
      score: parseFloat(data.imdbRating),
      maxScore: 10,
      icon: '⭐',
      url: data.imdbID ? `https://www.imdb.com/title/${data.imdbID}` : undefined,
    });
  }

  // Other ratings from Ratings array
  if (data.Ratings) {
    for (const rating of data.Ratings) {
      if (rating.Source === 'Rotten Tomatoes') {
        ratings.push({
          source: 'Rotten Tomatoes',
          score: rating.Value, // e.g., "96%"
          icon: '🍅',
          url: `https://www.rottentomatoes.com/search?search=${encodeURIComponent(data.Title || '')}`,
        });
      } else if (rating.Source === 'Metacritic') {
        const score = parseInt(rating.Value.split('/')[0]);
        ratings.push({
          source: 'Metacritic',
          score: score,
          maxScore: 100,
          icon: '🎯',
          url: `https://www.metacritic.com/search/all/${encodeURIComponent(data.Title || '')}/results`,
        });
      }
    }
  }

  return ratings;
}

// Get comprehensive ratings for a title
export async function getOMDbRatings(
  title: string,
  type?: 'movie' | 'series',
  year?: string,
  imdbId?: string
): Promise<ContentRating[]> {
  let data: OMDbResponse | null = null;

  // Try by IMDb ID first (more accurate)
  if (imdbId) {
    data = await getOMDbByImdbId(imdbId);
  }

  // Fall back to title search
  if (!data) {
    data = await searchOMDb(title, type, year);
  }

  if (!data) return [];

  return extractOMDbRatings(data);
}

// Get additional details not available from TMDb
export async function getOMDbDetails(
  title: string,
  type?: 'movie' | 'series',
  year?: string
): Promise<{
  ratings: ContentRating[];
  runtime?: string;
  director?: string;
  actors?: string[];
  boxOffice?: string;
  imdbId?: string;
  totalSeasons?: number;
} | null> {
  const data = await searchOMDb(title, type, year);
  if (!data) return null;

  return {
    ratings: extractOMDbRatings(data),
    runtime: data.Runtime !== 'N/A' ? data.Runtime : undefined,
    director: data.Director !== 'N/A' ? data.Director : undefined,
    actors: data.Actors !== 'N/A' ? data.Actors?.split(', ') : undefined,
    boxOffice: data.BoxOffice !== 'N/A' ? data.BoxOffice : undefined,
    imdbId: data.imdbID,
    totalSeasons: data.totalSeasons ? parseInt(data.totalSeasons) : undefined,
  };
}
