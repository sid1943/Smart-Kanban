// Game New Content Detection Strategy
// Checks for new games in a series or DLC using RAWG data

import { ContentType, GameData } from '../../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
} from '../NewContentDetector';

export class GameStrategy implements NewContentStrategy {
  readonly supportedTypes: ContentType[] = ['game'];

  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const { enrichedData } = context;

    // Must have game data
    if (!enrichedData || enrichedData.type !== 'game') {
      return { hasNewContent: false };
    }

    const gameData = enrichedData as GameData;

    // Check for sequels/new games in series
    const sequelResult = this.checkSequels(gameData);
    if (sequelResult.hasNewContent) {
      return sequelResult;
    }

    // Check for DLC
    const dlcResult = this.checkDLC(gameData);
    if (dlcResult.hasNewContent) {
      return dlcResult;
    }

    return {
      hasNewContent: false,
      debug: { reason: 'No new games or DLC found in series' },
    };
  }

  private checkSequels(gameData: GameData): NewContentDetectionResult {
    if (!gameData.related || gameData.related.length === 0) {
      return { hasNewContent: false };
    }

    // Look for sequel in related content
    const sequel = gameData.related.find(
      (r) => r.type === 'sequel' || r.type === 'series'
    );

    if (!sequel) {
      return { hasNewContent: false };
    }

    // Check if sequel is newer (released after current game)
    const gameYear = parseInt(gameData.year || '0', 10);
    const sequelYear = parseInt(sequel.year || '0', 10);
    const isNewer = sequelYear > gameYear;
    const isUpcoming = sequelYear > new Date().getFullYear();

    if (!isNewer && sequelYear !== 0) {
      return { hasNewContent: false };
    }

    return {
      hasNewContent: true,
      upcomingContent: {
        contentKind: 'sequel',
        title: sequel.title,
        releaseDate: sequel.year ? `${sequel.year}-01-01` : undefined,
        source: 'rawg',
      },
      debug: {
        reason: isUpcoming ? 'Sequel announced' : 'Sequel available',
        comparison: `${sequel.title} (${sequel.year || 'TBD'})`,
      },
    };
  }

  private checkDLC(gameData: GameData): NewContentDetectionResult {
    if (!gameData.related || gameData.related.length === 0) {
      return { hasNewContent: false };
    }

    // Look for DLC or expansions (stored as 'spinoff' type in related)
    const dlc = gameData.related.find((r) => r.type === 'spinoff');

    if (!dlc) {
      return { hasNewContent: false };
    }

    const gameYear = parseInt(gameData.year || '0', 10);
    const dlcYear = parseInt(dlc.year || '0', 10);

    // DLC should be same year or later
    if (dlcYear < gameYear && dlcYear !== 0) {
      return { hasNewContent: false };
    }

    return {
      hasNewContent: true,
      upcomingContent: {
        contentKind: 'dlc',
        title: dlc.title,
        releaseDate: dlc.year ? `${dlc.year}-01-01` : undefined,
        source: 'rawg',
      },
      debug: {
        reason: 'DLC available',
        comparison: dlc.title,
      },
    };
  }
}
