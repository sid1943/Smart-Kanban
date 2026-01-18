// Agents Module - Export all agents and orchestrator

// Base
export { BaseAgent, type DetectionContext, type AgentDetectionResult, type AgentConfig } from './BaseAgent';

// Orchestrator
export {
  AgentOrchestrator,
  getOrchestrator,
  resetOrchestrator,
  type OrchestratorConfig,
  type OrchestratorDetectionResult,
} from './AgentOrchestrator';

// Entertainment Agents
export { TVSeriesAgent } from './entertainment/TVSeriesAgent';
export { MovieAgent } from './entertainment/MovieAgent';
export { AnimeAgent } from './entertainment/AnimeAgent';

// Leisure Agents
export { BookAgent } from './leisure/BookAgent';
export { GameAgent } from './leisure/GameAgent';
