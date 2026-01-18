// Smart Content Engine - Main Entry Point
// Detects content type and enriches with relevant data
// Now powered by the Agent Architecture for modular, extensible processing

import {
  ContentType,
  DetectionResult,
  EnrichedData,
  EnrichmentResult,
  EntertainmentData,
  BookData,
  GameData,
} from './types';

import {
  detectContent,
  getContentTypeIcon,
  getContentTypeName,
} from './detection/ContentDetector';

// Agent Architecture - orchestrates specialized content agents
import {
  getOrchestrator,
  type DetectionContext,
  type OrchestratorDetectionResult,
} from './agents';

// Simple in-memory cache with TTL
interface CacheEntry {
  data: EnrichedData;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function getCacheKey(title: string, type: ContentType): string {
  return `${type}:${title.toLowerCase().trim()}`;
}

function getFromCache(key: string): EnrichedData | null {
  const entry = cache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(key);
    return null;
  }

  return entry.data;
}

function setCache(key: string, data: EnrichedData): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// Main detection function
export function detect(
  text: string,
  listContext?: string,
  urls?: string[]
): DetectionResult {
  return detectContent(text, listContext, urls);
}

// Main enrichment function - fetches data based on detected type
export async function enrich(
  text: string,
  detectedType?: ContentType,
  listContext?: string,
  urls?: string[],
  year?: string
): Promise<EnrichmentResult> {
  try {
    // Detect content type if not provided
    const detection = detectedType
      ? { type: detectedType, metadata: { title: text, year } } as DetectionResult
      : detect(text, listContext, urls);

    const { type, metadata } = detection;
    const title = metadata.title || text;
    const searchYear = year || metadata.year || metadata.yearRange?.split(/[-–—]/)[0];

    console.log('Content Engine enriching:', { type, title, year: searchYear });

    // Check cache first
    const cacheKey = getCacheKey(title, type);
    const cached = getFromCache(cacheKey);
    if (cached) {
      return {
        success: true,
        data: cached,
        cached: true,
        fetchedAt: new Date().toISOString(),
      };
    }

    let data: EnrichedData = null;

    // Use the Agent Orchestrator for enrichment
    // Each agent handles its own content type and API calls
    const orchestrator = getOrchestrator();

    if (type === 'unknown') {
      return {
        success: false,
        data: null,
        error: 'Unknown content type - cannot enrich',
      };
    }

    data = await orchestrator.enrich(title, type, searchYear);

    if (data) {
      setCache(cacheKey, data);
      return {
        success: true,
        data,
        cached: false,
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      success: false,
      data: null,
      error: 'No data found for this content',
    };
  } catch (error) {
    console.error('Enrichment error:', error);
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Export the orchestrator for direct access when needed
export { getOrchestrator };

// Export utility functions
export { getContentTypeIcon, getContentTypeName };

// Export types
export type {
  ContentType,
  DetectionResult,
  EnrichedData,
  EnrichmentResult,
  EntertainmentData,
  BookData,
  GameData,
};
