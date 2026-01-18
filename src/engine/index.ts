// Smart Content Engine - Public API
// Exports all necessary functions and types for the engine

export {
  detect,
  enrich,
  getContentTypeIcon,
  getContentTypeName,
  getOrchestrator,
} from './ContentEngine';

export type {
  ContentType,
  DetectionResult,
  EnrichedData,
  EnrichmentResult,
  EntertainmentData,
  BookData,
  GameData,
  ContentRating,
  StreamingAvailability,
  RelatedContent,
} from './types';

export {
  detectContent,
  isEntertainment,
  isLeisure,
} from './detection/ContentDetector';

// Agent Architecture exports
export {
  BaseAgent,
  AgentOrchestrator,
  resetOrchestrator,
  type DetectionContext,
  type AgentDetectionResult,
  type AgentConfig,
  type OrchestratorConfig,
  type OrchestratorDetectionResult,
} from './agents';

// Individual agents (for direct use or extension)
export {
  TVSeriesAgent,
  MovieAgent,
  AnimeAgent,
  BookAgent,
  GameAgent,
} from './agents';
