// Game Agent - Handles detection and enrichment for video games
// APIs: RAWG

import { BaseAgent, AgentDetectionResult, DetectionContext } from '../BaseAgent';
import { EnrichedData, GameData } from '../../types';
import { enrichFromRAWG } from '../../enrichment/rawg';

export class GameAgent extends BaseAgent {
  readonly type = 'game' as const;
  readonly name = 'Game Agent';
  readonly category = 'leisure' as const;
  readonly apis = ['RAWG'];

  // Strong signals for games
  protected keywords = [
    /\b(game|videogame|video\s*game)\b/i,
    /\b(playstation|ps[345]|ps\s*[345])\b/i,
    /\b(xbox|x\s*box|series\s*[xs])\b/i,
    /\b(nintendo|switch|wii\s*u?)\b/i,
    /\b(steam|epic\s*games|gog|origin)\b/i,
    /\b(dlc|expansion|season\s*pass)\b/i,
  ];

  // Weak/context signals
  protected contextKeywords = [
    /\b(pc\s*game|gaming|gamer)\b/i,
    /\b(multiplayer|singleplayer|co-?op|pvp|pve)\b/i,
    /\b(rpg|fps|mmorpg|rts|moba|roguelike)\b/i,
    /\b(playthrough|speedrun|100%|completionist)\b/i,
    /\b(graphics|gameplay|controls)\b/i,
    /\b(developer|publisher|studio)\b/i,
    /\b(early\s*access|beta|alpha)\b/i,
  ];

  // URL patterns that indicate games
  protected urlPatterns = [
    { pattern: /store\.steampowered\.com\/app\/\d+/i, weight: 60 },
    { pattern: /rawg\.io\/games/i, weight: 55 },
    { pattern: /metacritic\.com\/game/i, weight: 50 },
    { pattern: /ign\.com.*\/games\//i, weight: 40 },
    { pattern: /gog\.com\/game/i, weight: 50 },
    { pattern: /epicgames\.com/i, weight: 40 },
    { pattern: /playstation\.com.*\/games\//i, weight: 45 },
    { pattern: /xbox\.com.*\/games\//i, weight: 45 },
    { pattern: /howlongtobeat\.com/i, weight: 50 },
  ];

  // List context mappings
  protected getListContextMappings(): [string, number][] {
    return [
      ['games', 35],
      ['gaming', 30],
      ['playing', 25],
      ['backlog', 20],
      ['to_play', 25],
      ['played', 20],
      ['completed', 15],
      ['wishlist', 15],
    ];
  }

  // Additional game-specific detection
  canHandle(context: DetectionContext): AgentDetectionResult {
    const result = super.canHandle(context);

    // Check for platform mentions
    const platforms = this.detectPlatforms(context.title + ' ' + (context.description || ''));
    if (platforms.length > 0) {
      result.confidence = Math.min(100, result.confidence + 20);
      result.signals.push(`Platforms: ${platforms.join(', ')}`);
    }

    // Check for genre indicators in description
    if (context.description) {
      const genres = this.detectGenres(context.description);
      if (genres.length >= 2) {
        result.confidence = Math.min(100, result.confidence + 15);
        result.signals.push(`Game genres: ${genres.join(', ')}`);
      }
    }

    // Check for playtime mentions
    const playtimeMatch = (context.description || '').match(/\b(\d+)\s*(hours?|hrs?)\s*(to\s*beat|playtime|gameplay)/i);
    if (playtimeMatch) {
      result.confidence = Math.min(100, result.confidence + 15);
      result.signals.push(`Playtime mentioned: ${playtimeMatch[0]}`);
    }

    return result;
  }

  // Detect gaming platforms in text
  private detectPlatforms(text: string): string[] {
    const platforms: string[] = [];
    const patterns: [RegExp, string][] = [
      [/\b(pc|windows)\b/i, 'PC'],
      [/\b(ps[345]|playstation\s*[345]?)\b/i, 'PlayStation'],
      [/\b(xbox|series\s*[xs])\b/i, 'Xbox'],
      [/\b(switch|nintendo)\b/i, 'Nintendo'],
      [/\b(steam)\b/i, 'Steam'],
      [/\b(mac|macos)\b/i, 'Mac'],
      [/\b(linux)\b/i, 'Linux'],
      [/\b(mobile|ios|android)\b/i, 'Mobile'],
    ];

    for (const [pattern, name] of patterns) {
      if (pattern.test(text) && !platforms.includes(name)) {
        platforms.push(name);
      }
    }

    return platforms;
  }

  // Detect game genres in text
  private detectGenres(text: string): string[] {
    const genres: string[] = [];
    const patterns: [RegExp, string][] = [
      [/\b(rpg|role-?playing)\b/i, 'RPG'],
      [/\b(fps|first-?person\s*shooter)\b/i, 'FPS'],
      [/\b(action|adventure)\b/i, 'Action'],
      [/\b(strategy|rts|turn-?based)\b/i, 'Strategy'],
      [/\b(puzzle|platformer)\b/i, 'Puzzle/Platformer'],
      [/\b(horror|survival)\b/i, 'Horror/Survival'],
      [/\b(simulation|sim)\b/i, 'Simulation'],
      [/\b(racing|sports)\b/i, 'Racing/Sports'],
      [/\b(indie)\b/i, 'Indie'],
      [/\b(mmo|mmorpg|multiplayer)\b/i, 'MMO'],
    ];

    for (const [pattern, name] of patterns) {
      if (pattern.test(text) && !genres.includes(name)) {
        genres.push(name);
      }
    }

    return genres;
  }

  // Fetch enriched data for games
  async enrich(title: string, year?: string): Promise<EnrichedData> {
    console.log(`[GameAgent] Enriching: ${title}`);

    const gameData = await enrichFromRAWG(title);
    if (!gameData) {
      console.log(`[GameAgent] No RAWG data found for: ${title}`);
      return null;
    }

    const enrichedData: GameData = {
      ...gameData,
      title: gameData.title || title, // Ensure title is always set
      type: 'game',
      ratings: gameData.ratings || [], // Ensure ratings is always an array
      links: gameData.links || [], // Ensure links is always an array
    };

    console.log(`[GameAgent] Enriched: ${title}`);
    return enrichedData;
  }
}

export default GameAgent;
