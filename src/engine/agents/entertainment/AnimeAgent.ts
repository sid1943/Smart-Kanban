// Anime Agent - Handles detection and enrichment for anime
// APIs: Jikan (MyAnimeList)

import { BaseAgent, AgentDetectionResult, DetectionContext } from '../BaseAgent';
import { EnrichedData, EntertainmentData } from '../../types';
import { enrichFromJikan } from '../../enrichment/jikan';

export class AnimeAgent extends BaseAgent {
  readonly type = 'anime' as const;
  readonly name = 'Anime Agent';
  readonly category = 'entertainment' as const;
  readonly apis = ['Jikan (MAL)'];

  // Strong signals for anime
  protected keywords = [
    /\banime\b/i,
    /\bmanga\b/i,
    /\b(ova|ona|oad)\b/i,
    /\b(sub|dub|subbed|dubbed)\b/i,
    /\b(crunchyroll|funimation|wakanim)\b/i,
    /\bmyanimelist\b/i,
  ];

  // Weak/context signals (anime genres/themes)
  protected contextKeywords = [
    /\b(shonen|shounen|shojo|shoujo|seinen|josei)\b/i,
    /\b(isekai|mecha|slice\s*of\s*life)\b/i,
    /\b(senpai|sensei|chan|kun|san|sama)\b/i,
    /\b(waifu|husbando|best\s*girl)\b/i,
    /\b(studio\s*ghibli|toei|madhouse|bones|mappa)\b/i,
    /\b(light\s*novel|ln|web\s*novel|wn)\b/i,
  ];

  // URL patterns that indicate anime
  protected urlPatterns = [
    { pattern: /myanimelist\.net\/anime\/\d+/i, weight: 60 },
    { pattern: /anilist\.co\/anime\/\d+/i, weight: 60 },
    { pattern: /crunchyroll\.com/i, weight: 40 },
    { pattern: /funimation\.com/i, weight: 40 },
    { pattern: /kitsu\.io\/anime/i, weight: 50 },
    { pattern: /anidb\.net/i, weight: 50 },
  ];

  // List context mappings
  protected getListContextMappings(): [string, number][] {
    return [
      ['anime', 40],
      ['watching', 15],
      ['to_watch', 10],
      ['completed', 10],
      ['plan_to_watch', 15],
      ['dropped', 5],
    ];
  }

  // Additional anime-specific detection
  canHandle(context: DetectionContext): AgentDetectionResult {
    const result = super.canHandle(context);

    // Check for Japanese characters in title
    if (this.hasJapaneseCharacters(context.title)) {
      result.confidence = Math.min(100, result.confidence + 25);
      result.signals.push('Japanese characters detected');
    }

    // Check for common anime title patterns
    if (this.hasAnimeNamePattern(context.title)) {
      result.confidence = Math.min(100, result.confidence + 15);
      result.signals.push('Anime naming pattern detected');
    }

    // Year range boosts anime (multi-season common)
    if (result.metadata.yearRange) {
      result.confidence = Math.min(100, result.confidence + 15);
      result.signals.push('Year range (anime series indicator)');
    }

    return result;
  }

  // Check for Japanese characters (hiragana, katakana, kanji)
  private hasJapaneseCharacters(text: string): boolean {
    return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(text);
  }

  // Check for common anime naming patterns
  private hasAnimeNamePattern(title: string): boolean {
    // Patterns like "Title: Subtitle", "Title!!", "Title -Subtitle-"
    return /[!！]{2,}|[:：]\s*[A-Z]|[-－]\s*[A-Z].*[-－]$/.test(title);
  }

  // Fetch enriched data for anime
  async enrich(title: string, year?: string): Promise<EnrichedData> {
    console.log(`[AnimeAgent] Enriching: ${title}`);

    const jikanData = await enrichFromJikan(title);
    if (!jikanData) {
      console.log(`[AnimeAgent] No Jikan data found for: ${title}`);
      return null;
    }

    const enrichedData: EntertainmentData = {
      ...jikanData,
      title: jikanData.title || title, // Ensure title is always set
      type: 'anime',
      ratings: jikanData.ratings || [], // Ensure ratings is always an array
      links: jikanData.links || [], // Ensure links is always an array
    };

    console.log(`[AnimeAgent] Enriched: ${title}`);
    return enrichedData;
  }
}

export default AnimeAgent;
