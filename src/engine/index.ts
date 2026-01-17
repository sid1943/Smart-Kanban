// Smart Content Engine - Public API
// Exports all necessary functions and types for the engine

export {
  detect,
  enrich,
  getContentTypeIcon,
  getContentTypeName,
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
