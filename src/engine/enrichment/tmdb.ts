// TMDb API Client - Movies & TV Shows
// Free API: https://www.themoviedb.org/documentation/api

import { EntertainmentData, ContentRating, StreamingAvailability, RelatedContent } from '../types';

// TMDb API key - Free tier (limited to 40 requests/10 seconds)
// Users should get their own key at https://www.themoviedb.org/settings/api
const TMDB_API_KEY = import.meta.env.VITE_TMDB_API_KEY || '4733992aa020cb5c1666838f6ae0a19c';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Debug: log if API key is loaded
console.log('TMDb API Key loaded:', TMDB_API_KEY ? 'Yes' : 'No');

interface TMDbSearchResult {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  media_type?: string;
}

interface TMDbDetails {
  id: number;
  title?: string;
  name?: string;
  release_date?: string;
  first_air_date?: string;
  last_air_date?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  runtime?: number;
  episode_run_time?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  genres?: { id: number; name: string }[];
  imdb_id?: string;
  belongs_to_collection?: {
    id: number;
    name: string;
  };
}

interface TMDbWatchProviders {
  results?: {
    US?: {
      flatrate?: { provider_name: string; logo_path: string }[];
      rent?: { provider_name: string; logo_path: string }[];
      buy?: { provider_name: string; logo_path: string }[];
    };
  };
}

export async function searchTMDb(
  query: string,
  type: 'movie' | 'tv' = 'movie',
  year?: string
): Promise<TMDbSearchResult | null> {
  if (!TMDB_API_KEY) {
    console.warn('TMDb API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      query: query,
      include_adult: 'false',
    });

    if (year) {
      params.append(type === 'movie' ? 'year' : 'first_air_date_year', year);
    }

    const url = `${TMDB_BASE_URL}/search/${type}?${params}`;
    console.log('TMDb search:', query, type, url);

    const response = await fetch(url);
    console.log('TMDb response status:', response.status);

    if (!response.ok) {
      console.error('TMDb response not ok:', response.status, response.statusText);
      return null;
    }

    const data = await response.json();
    console.log('TMDb results:', data.results?.length || 0, 'found');
    return data.results?.[0] || null;
  } catch (error) {
    console.error('TMDb search error:', error);
    return null;
  }
}

export async function getTMDbDetails(
  id: number,
  type: 'movie' | 'tv'
): Promise<TMDbDetails | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}?api_key=${TMDB_API_KEY}&append_to_response=external_ids`
    );
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('TMDb details error:', error);
    return null;
  }
}

export async function getTMDbWatchProviders(
  id: number,
  type: 'movie' | 'tv'
): Promise<StreamingAvailability[]> {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/${type}/${id}/watch/providers?api_key=${TMDB_API_KEY}`
    );
    if (!response.ok) return [];

    const data: TMDbWatchProviders = await response.json();
    const usProviders = data.results?.US;
    if (!usProviders) return [];

    const providers: StreamingAvailability[] = [];

    // Subscription services
    if (usProviders.flatrate) {
      for (const p of usProviders.flatrate.slice(0, 4)) {
        providers.push({
          service: p.provider_name,
          type: 'subscription',
          logo: p.logo_path ? `${TMDB_IMAGE_BASE}/w45${p.logo_path}` : undefined,
        });
      }
    }

    // Rent options
    if (usProviders.rent) {
      for (const p of usProviders.rent.slice(0, 2)) {
        providers.push({
          service: p.provider_name,
          type: 'rent',
          logo: p.logo_path ? `${TMDB_IMAGE_BASE}/w45${p.logo_path}` : undefined,
        });
      }
    }

    return providers;
  } catch (error) {
    console.error('TMDb watch providers error:', error);
    return [];
  }
}

export async function getTMDbCollection(
  collectionId: number
): Promise<RelatedContent[]> {
  if (!TMDB_API_KEY) return [];

  try {
    const response = await fetch(
      `${TMDB_BASE_URL}/collection/${collectionId}?api_key=${TMDB_API_KEY}`
    );
    if (!response.ok) return [];

    const data = await response.json();
    return (data.parts || []).map((part: TMDbSearchResult) => ({
      type: 'series' as const,
      title: part.title || part.name || '',
      year: (part.release_date || part.first_air_date)?.split('-')[0],
      id: String(part.id),
    }));
  } catch (error) {
    console.error('TMDb collection error:', error);
    return [];
  }
}

export async function enrichFromTMDb(
  title: string,
  type: 'movie' | 'tv_series',
  year?: string
): Promise<Partial<EntertainmentData> | null> {
  const mediaType = type === 'tv_series' ? 'tv' : 'movie';

  // Search for the title
  const searchResult = await searchTMDb(title, mediaType, year);
  if (!searchResult) return null;

  // Get full details
  const details = await getTMDbDetails(searchResult.id, mediaType);
  if (!details) return null;

  // Get streaming providers
  const streaming = await getTMDbWatchProviders(searchResult.id, mediaType);

  // Get collection/franchise info for movies
  let franchise = undefined;
  let related: RelatedContent[] = [];

  if (type === 'movie' && details.belongs_to_collection) {
    const collectionItems = await getTMDbCollection(details.belongs_to_collection.id);
    if (collectionItems.length > 1) {
      const position = collectionItems.findIndex(item => item.id === String(details.id)) + 1;
      franchise = {
        name: details.belongs_to_collection.name,
        position: position > 0 ? position : undefined,
        total: collectionItems.length,
        items: collectionItems.map(item => ({
          title: item.title,
          year: item.year,
        })),
      };
      related = collectionItems.filter(item => item.id !== String(details.id));
    }
  }

  // Build ratings
  const ratings: ContentRating[] = [];
  if (details.vote_average && details.vote_average > 0) {
    ratings.push({
      source: 'TMDb',
      score: Math.round(details.vote_average * 10) / 10,
      maxScore: 10,
      icon: '🎬',
      url: `https://www.themoviedb.org/${mediaType}/${details.id}`,
    });
  }

  // Build links
  const links = [
    {
      name: 'TMDb',
      url: `https://www.themoviedb.org/${mediaType}/${details.id}`,
      icon: '🎬',
    },
  ];

  if (details.imdb_id) {
    links.unshift({
      name: 'IMDb',
      url: `https://www.imdb.com/title/${details.imdb_id}`,
      icon: '⭐',
    });
  }

  return {
    type: type === 'tv_series' ? 'tv_series' : 'movie',
    title: details.title || details.name || title,
    year: type === 'movie'
      ? details.release_date?.split('-')[0]
      : undefined,
    yearRange: type === 'tv_series' && details.first_air_date
      ? `${details.first_air_date.split('-')[0]}${details.last_air_date ? ' - ' + details.last_air_date.split('-')[0] : ''}`
      : undefined,
    ratings,
    runtime: type === 'movie' && details.runtime
      ? `${details.runtime} min`
      : details.episode_run_time?.[0]
        ? `${details.episode_run_time[0]} min/ep`
        : undefined,
    seasons: details.number_of_seasons,
    episodes: details.number_of_episodes,
    status: details.status === 'Ended' || details.status === 'Released'
      ? 'ended'
      : details.status === 'Returning Series' || details.status === 'In Production'
        ? 'ongoing'
        : undefined,
    genres: details.genres?.map(g => g.name),
    streaming,
    imdbId: details.imdb_id,
    tmdbId: String(details.id),
    links,
    related: related.length > 0 ? related : undefined,
    franchise,
    poster: details.poster_path
      ? `${TMDB_IMAGE_BASE}/w342${details.poster_path}`
      : undefined,
    backdrop: details.backdrop_path
      ? `${TMDB_IMAGE_BASE}/w780${details.backdrop_path}`
      : undefined,
  };
}
