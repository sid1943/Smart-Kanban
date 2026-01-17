// RAWG API Client - Video Games
// Free API: https://rawg.io/apidocs (Free tier available)

import { GameData, ContentRating, RelatedContent } from '../types';

// RAWG API key - Free tier
// Get your own key at https://rawg.io/apidocs
const RAWG_API_KEY = import.meta.env.VITE_RAWG_API_KEY || '';
const RAWG_BASE_URL = 'https://api.rawg.io/api';

interface RAWGGame {
  id: number;
  slug: string;
  name: string;
  released?: string;
  background_image?: string;
  rating?: number;
  ratings_count?: number;
  metacritic?: number;
  playtime?: number;
  platforms?: { platform: { id: number; name: string; slug: string } }[];
  genres?: { id: number; name: string }[];
  developers?: { id: number; name: string }[];
  publishers?: { id: number; name: string }[];
  description_raw?: string;
  website?: string;
  stores?: { store: { id: number; name: string; slug: string } }[];
}

interface RAWGSearchResult {
  count: number;
  results: RAWGGame[];
}

export async function searchRAWG(query: string): Promise<RAWGGame | null> {
  if (!RAWG_API_KEY) {
    console.warn('RAWG API key not configured');
    return null;
  }

  try {
    const params = new URLSearchParams({
      key: RAWG_API_KEY,
      search: query,
      page_size: '1',
    });

    const response = await fetch(`${RAWG_BASE_URL}/games?${params}`);
    if (!response.ok) return null;

    const data: RAWGSearchResult = await response.json();
    return data.results?.[0] || null;
  } catch (error) {
    console.error('RAWG search error:', error);
    return null;
  }
}

export async function getRAWGGame(id: number): Promise<RAWGGame | null> {
  if (!RAWG_API_KEY) return null;

  try {
    const response = await fetch(`${RAWG_BASE_URL}/games/${id}?key=${RAWG_API_KEY}`);
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('RAWG game fetch error:', error);
    return null;
  }
}

export async function getRAWGGameSeries(id: number): Promise<RelatedContent[]> {
  if (!RAWG_API_KEY) return [];

  try {
    const response = await fetch(`${RAWG_BASE_URL}/games/${id}/game-series?key=${RAWG_API_KEY}`);
    if (!response.ok) return [];

    const data: RAWGSearchResult = await response.json();
    return data.results.slice(0, 5).map(game => ({
      type: 'series' as const,
      title: game.name,
      year: game.released?.split('-')[0],
      id: String(game.id),
      url: `https://rawg.io/games/${game.slug}`,
    }));
  } catch (error) {
    console.error('RAWG series fetch error:', error);
    return [];
  }
}

// Platform name mapping
function normalizePlatformName(name: string): string {
  const platformMap: Record<string, string> = {
    'playstation 5': 'PS5',
    'playstation 4': 'PS4',
    'playstation 3': 'PS3',
    'xbox series s/x': 'Xbox Series',
    'xbox one': 'Xbox One',
    'xbox 360': 'Xbox 360',
    'nintendo switch': 'Switch',
    'pc': 'PC',
    'macos': 'Mac',
    'linux': 'Linux',
    'ios': 'iOS',
    'android': 'Android',
  };

  const lower = name.toLowerCase();
  return platformMap[lower] || name;
}

export async function enrichFromRAWG(title: string): Promise<Partial<GameData> | null> {
  // Search for the game
  const searchResult = await searchRAWG(title);
  if (!searchResult) return null;

  // Get full details
  const game = await getRAWGGame(searchResult.id);
  if (!game) return null;

  // Get series/related games
  const related = await getRAWGGameSeries(game.id);

  // Build ratings
  const ratings: ContentRating[] = [];

  if (game.rating) {
    ratings.push({
      source: 'RAWG',
      score: Math.round(game.rating * 10) / 10,
      maxScore: 5,
      icon: '🎮',
      url: `https://rawg.io/games/${game.slug}`,
    });
  }

  if (game.metacritic) {
    ratings.push({
      source: 'Metacritic',
      score: game.metacritic,
      maxScore: 100,
      icon: '🎯',
      url: `https://www.metacritic.com/search/game/${encodeURIComponent(game.name)}/results`,
    });
  }

  // Build links
  const links = [
    {
      name: 'RAWG',
      url: `https://rawg.io/games/${game.slug}`,
      icon: '🎮',
    },
  ];

  if (game.website) {
    links.push({
      name: 'Official Site',
      url: game.website,
      icon: '🌐',
    });
  }

  // Add store links
  if (game.stores) {
    for (const store of game.stores.slice(0, 3)) {
      const storeUrls: Record<string, string> = {
        steam: `https://store.steampowered.com/search/?term=${encodeURIComponent(game.name)}`,
        'playstation-store': 'https://store.playstation.com',
        'xbox-store': 'https://www.xbox.com/games/store',
        'nintendo-eshop': 'https://www.nintendo.com/store/games',
        'epic-games': 'https://store.epicgames.com',
        gog: `https://www.gog.com/games?search=${encodeURIComponent(game.name)}`,
      };

      if (storeUrls[store.store.slug]) {
        links.push({
          name: store.store.name,
          url: storeUrls[store.store.slug],
          icon: '🛒',
        });
      }
    }
  }

  // Extract platforms
  const platforms = game.platforms?.map(p => normalizePlatformName(p.platform.name)) || [];

  return {
    type: 'game',
    title: game.name,
    year: game.released?.split('-')[0],
    ratings,
    platforms: [...new Set(platforms)], // Remove duplicates
    genres: game.genres?.map(g => g.name),
    developer: game.developers?.[0]?.name,
    publisher: game.publishers?.[0]?.name,
    playtime: game.playtime ? `${game.playtime} hours` : undefined,
    links,
    related: related.length > 0 ? related : undefined,
    cover: game.background_image,
  };
}
