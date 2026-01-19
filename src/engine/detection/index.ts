// New Content Detection Module
// Re-exports all detection-related types and classes

export type {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
  ChecklistInfo,
} from './NewContentDetector';

export {
  getContentKindLabel,
  isUpcoming,
} from './NewContentDetector';

export {
  NewContentOrchestrator,
  getNewContentOrchestrator,
  resetNewContentOrchestrator,
} from './NewContentOrchestrator';

// Strategy exports (for direct usage if needed)
export { TVSeriesStrategy } from './strategies/TVSeriesStrategy';
export { MovieStrategy } from './strategies/MovieStrategy';
export { AnimeStrategy } from './strategies/AnimeStrategy';
export { BookStrategy } from './strategies/BookStrategy';
export { GameStrategy } from './strategies/GameStrategy';
