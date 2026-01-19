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
  UpcomingContent,
  UpcomingContentKind,
  UpcomingContentSource,
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

// New Content Detection System
export {
  NewContentOrchestrator,
  getNewContentOrchestrator,
  resetNewContentOrchestrator,
  getContentKindLabel,
  isUpcoming,
  type NewContentStrategy,
  type NewContentDetectionContext,
  type NewContentDetectionResult,
  type ChecklistInfo,
} from './detection';

// Worker System exports (background processing)
export {
  // Message types and bus
  MessageBus,
  getMessageBus,
  // Worker pool
  WorkerPool,
  getWorkerPool,
  initializeWorkerPool,
  // Task coordination
  TaskCoordinator,
  getTaskCoordinator,
  initializeTaskCoordinator,
  TaskQueue,
  getTaskQueue,
  RateLimiter,
  getRateLimiter,
  // Conflict resolution
  ConflictResolver,
  getConflictResolver,
  // Validation
  ValidationPipeline,
  getValidationPipeline,
  // Convenience functions
  initializeWorkerSystem,
  shutdownWorkerSystem,
  // Types
  type AgentId,
  type MessageType,
  type AgentMessage,
  type EnrichmentTask,
  type WorkerStatus,
  type PoolStats,
  type QueueStats,
  type TaskResult,
  type ValidationResult,
  type ResolutionResult,
} from './workers';
