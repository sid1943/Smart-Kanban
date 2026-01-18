// Base Agent - Abstract class for all content agents
// Each agent handles detection + enrichment for a specific content type

import { ContentType, EnrichedData, ContentRating } from '../types';

// Context passed to agents for detection
export interface DetectionContext {
  title: string;
  description?: string;
  listContext?: string;
  urls?: string[];
  checklistNames?: string[];
}

// Result from agent detection
export interface AgentDetectionResult {
  type: ContentType;
  confidence: number;
  signals: string[];
  metadata: {
    title?: string;
    year?: string;
    yearRange?: string;
    author?: string;
    [key: string]: string | undefined;
  };
}

// Base agent configuration
export interface AgentConfig {
  enabled: boolean;
  priority: number; // Higher = checked first when confidence is equal
}

// Abstract base class for all content agents
export abstract class BaseAgent {
  abstract readonly type: ContentType;
  abstract readonly name: string;
  abstract readonly category: 'entertainment' | 'leisure';
  abstract readonly apis: string[];

  config: AgentConfig = {
    enabled: true,
    priority: 50,
  };

  // Keywords that strongly indicate this content type
  protected abstract keywords: RegExp[];

  // Keywords that provide weak signals
  protected abstract contextKeywords: RegExp[];

  // URL patterns that indicate this content type
  protected abstract urlPatterns: { pattern: RegExp; weight: number }[];

  constructor(config?: Partial<AgentConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * Analyze text and return confidence score (0-100)
   * Higher confidence = more likely this agent should handle the content
   */
  canHandle(context: DetectionContext): AgentDetectionResult {
    if (!this.config.enabled) {
      return this.createResult(0, []);
    }

    let score = 0;
    const signals: string[] = [];
    const metadata: AgentDetectionResult['metadata'] = {};

    // Check URL patterns (highest weight)
    if (context.urls) {
      for (const url of context.urls) {
        for (const { pattern, weight } of this.urlPatterns) {
          if (pattern.test(url)) {
            score += weight;
            signals.push(`URL pattern matched: ${pattern.source}`);
          }
        }
      }
    }

    // Combine all text for analysis
    const allText = this.combineText(context);
    const lowerText = allText.toLowerCase();

    // Check strong keywords
    for (const keyword of this.keywords) {
      if (keyword.test(allText)) {
        score += 30;
        signals.push(`Keyword: ${keyword.source}`);
      }
    }

    // Check context keywords (weaker signal)
    for (const keyword of this.contextKeywords) {
      if (keyword.test(lowerText)) {
        score += 15;
        signals.push(`Context: ${keyword.source}`);
      }
    }

    // Check list context
    const listScore = this.checkListContext(context.listContext);
    if (listScore > 0) {
      score += listScore;
      signals.push(`List context: ${context.listContext}`);
    }

    // Extract metadata
    const extractedMeta = this.extractMetadata(allText, context);
    Object.assign(metadata, extractedMeta);

    // Clean title
    metadata.title = this.cleanTitle(context.title);

    // Cap confidence at 100
    const confidence = Math.min(100, score);

    return this.createResult(confidence, signals, metadata);
  }

  /**
   * Fetch enriched data for the content
   * Must be implemented by each agent
   */
  abstract enrich(title: string, year?: string): Promise<EnrichedData>;

  // Helper: Create detection result
  protected createResult(
    confidence: number,
    signals: string[],
    metadata: AgentDetectionResult['metadata'] = {}
  ): AgentDetectionResult {
    return {
      type: this.type,
      confidence,
      signals,
      metadata,
    };
  }

  // Helper: Combine all context text
  protected combineText(context: DetectionContext): string {
    const parts = [
      context.title,
      context.description || '',
      context.listContext || '',
      ...(context.checklistNames || []),
    ];
    return parts.join(' ');
  }

  // Helper: Check list context for signals
  protected checkListContext(listContext?: string): number {
    if (!listContext) return 0;

    const normalized = listContext.toLowerCase().replace(/[\s_-]+/g, '_');
    const listMappings = this.getListContextMappings();

    for (const [pattern, score] of listMappings) {
      if (normalized.includes(pattern)) {
        return score;
      }
    }
    return 0;
  }

  // Override in subclasses for type-specific list context mappings
  protected getListContextMappings(): [string, number][] {
    return [];
  }

  // Helper: Extract metadata from text
  protected extractMetadata(
    text: string,
    context: DetectionContext
  ): Partial<AgentDetectionResult['metadata']> {
    const metadata: Partial<AgentDetectionResult['metadata']> = {};

    // Extract year range (e.g., "2015-2019")
    const yearRangeMatch = text.match(/\b(19|20)\d{2}\s*[-–—]\s*(19|20)?\d{2,4}\b/);
    if (yearRangeMatch) {
      metadata.yearRange = yearRangeMatch[0];
    }

    // Extract single year (e.g., "2015")
    const yearMatch = text.match(/\b(19|20)\d{2}\b/);
    if (yearMatch && !metadata.yearRange) {
      metadata.year = yearMatch[0];
    }

    return metadata;
  }

  // Helper: Clean title (remove year patterns, etc.)
  protected cleanTitle(title: string): string {
    return title
      .replace(/\s*\(\s*(19|20)\d{2}\s*[-–—]?\s*((19|20)?\d{2,4}|present)?\s*\)/gi, '')
      .replace(/\s*[-–—]\s*(19|20)\d{2}.*$/g, '')
      .trim();
  }

  // Helper: Build ratings array
  protected buildRatings(ratings: Partial<ContentRating>[]): ContentRating[] {
    return ratings.filter(r => r.source && (r.score !== undefined)) as ContentRating[];
  }
}

export default BaseAgent;
