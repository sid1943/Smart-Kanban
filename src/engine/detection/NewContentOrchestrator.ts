// New Content Orchestrator
// Manages detection strategies and routes content to the appropriate strategy

import { ContentType } from '../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
} from './NewContentDetector';

// Import all strategies
import { TVSeriesStrategy } from './strategies/TVSeriesStrategy';
import { MovieStrategy } from './strategies/MovieStrategy';
import { AnimeStrategy } from './strategies/AnimeStrategy';
import { BookStrategy } from './strategies/BookStrategy';
import { GameStrategy } from './strategies/GameStrategy';

export class NewContentOrchestrator {
  private strategies: NewContentStrategy[] = [];
  private strategyMap: Map<ContentType, NewContentStrategy> = new Map();

  constructor() {
    this.initializeStrategies();
  }

  private initializeStrategies(): void {
    // Register all strategies
    const allStrategies: NewContentStrategy[] = [
      new TVSeriesStrategy(),
      new MovieStrategy(),
      new AnimeStrategy(),
      new BookStrategy(),
      new GameStrategy(),
    ];

    this.strategies = allStrategies;

    // Build lookup map for quick access
    for (const strategy of allStrategies) {
      for (const type of strategy.supportedTypes) {
        this.strategyMap.set(type, strategy);
      }
    }

    console.log(
      '[NewContentOrchestrator] Initialized with strategies:',
      this.strategies.map((s) => s.supportedTypes.join(', ')).join(' | ')
    );
  }

  /**
   * Get the appropriate strategy for a content type
   */
  getStrategy(type: ContentType): NewContentStrategy | undefined {
    return this.strategyMap.get(type);
  }

  /**
   * Detect new content using the appropriate strategy
   */
  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const strategy = this.getStrategy(context.contentType);

    if (!strategy) {
      console.log(
        `[NewContentOrchestrator] No strategy for type: ${context.contentType}`
      );
      return { hasNewContent: false };
    }

    try {
      const result = strategy.detect(context);
      console.log(
        `[NewContentOrchestrator] Detection for ${context.title}:`,
        result.hasNewContent ? 'NEW CONTENT' : 'No new content',
        result.debug?.reason || ''
      );
      return result;
    } catch (error) {
      console.error(
        `[NewContentOrchestrator] Error detecting for ${context.title}:`,
        error
      );
      return { hasNewContent: false };
    }
  }

  /**
   * Check if a content type is supported for new content detection
   */
  isSupported(type: ContentType): boolean {
    return this.strategyMap.has(type);
  }

  /**
   * Get all supported content types
   */
  getSupportedTypes(): ContentType[] {
    return Array.from(this.strategyMap.keys());
  }
}

// Singleton instance
let instance: NewContentOrchestrator | null = null;

export function getNewContentOrchestrator(): NewContentOrchestrator {
  if (!instance) {
    instance = new NewContentOrchestrator();
  }
  return instance;
}

export function resetNewContentOrchestrator(): void {
  instance = null;
}
