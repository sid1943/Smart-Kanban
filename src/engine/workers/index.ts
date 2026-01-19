// Agent Coordination System - Public API
// Background workers for parallel content detection and enrichment

// Messaging types and bus
export {
  type AgentId,
  type MessageType,
  type AgentMessage,
  type EnrichmentTask,
  type ConflictClaim,
  type ValidationIssue,
  type WorkerStatus,
  type DetectionRequestPayload,
  type DetectionResponsePayload,
  type TaskAssignPayload,
  type TaskCompletePayload,
  type TaskFailedPayload,
  type TaskProgressPayload,
  type ConflictVoteRequestPayload,
  type ConflictResolvedPayload,
  type ValidationRequestPayload,
  type ValidationResponsePayload,
} from './messaging/types';

export {
  MessageBus,
  getMessageBus,
  resetMessageBus,
  type MessageFilter,
  type MessageBusOptions,
} from './messaging/MessageBus';

// Worker pool
export {
  AgentWorker,
  type WorkerDetectionResult,
  type WorkerProcessResult,
  type WorkerStatusInfo,
} from './pool/AgentWorker';

export {
  WorkerPool,
  getWorkerPool,
  initializeWorkerPool,
  resetWorkerPool,
  type WorkerPoolConfig,
  type PoolStats,
} from './pool/WorkerPool';

// Task coordination
export {
  RateLimiter,
  getRateLimiter,
  resetRateLimiter,
  API_RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitCheckResult,
} from './coordinator/RateLimiter';

export {
  TaskQueue,
  getTaskQueue,
  resetTaskQueue,
  type CreateTaskOptions,
  type QueueStats,
} from './coordinator/TaskQueue';

export {
  TaskCoordinator,
  getTaskCoordinator,
  initializeTaskCoordinator,
  resetTaskCoordinator,
  type CoordinatorConfig,
  type TaskCompletionCallback,
  type TaskErrorCallback,
  type TaskProgressCallback,
  type TaskResult,
} from './coordinator/TaskCoordinator';

// Conflict resolution
export {
  ConflictResolver,
  getConflictResolver,
  resetConflictResolver,
  type ResolutionMethod,
  type ResolutionResult,
} from './conflict/ConflictResolver';

// Validation
export {
  ValidationPipeline,
  getValidationPipeline,
  resetValidationPipeline,
  type ValidationResult,
} from './validation/ValidationPipeline';

// Convenience function to initialize the entire system
export async function initializeWorkerSystem(options?: {
  coordinatorConfig?: Partial<import('./coordinator/TaskCoordinator').CoordinatorConfig>;
  poolConfig?: Partial<import('./pool/WorkerPool').WorkerPoolConfig>;
}): Promise<{
  coordinator: import('./coordinator/TaskCoordinator').TaskCoordinator;
  pool: import('./pool/WorkerPool').WorkerPool;
  bus: import('./messaging/MessageBus').MessageBus;
}> {
  const { getMessageBus: getBus } = await import('./messaging/MessageBus');
  const { initializeWorkerPool: initPool } = await import('./pool/WorkerPool');
  const { initializeTaskCoordinator: initCoord } = await import('./coordinator/TaskCoordinator');

  const bus = getBus();
  const pool = await initPool(options?.poolConfig);
  const coordinator = await initCoord(options?.coordinatorConfig);

  return { coordinator, pool, bus };
}

// Cleanup function
export async function shutdownWorkerSystem(): Promise<void> {
  const { resetTaskCoordinator: resetCoord } = await import('./coordinator/TaskCoordinator');
  const { resetWorkerPool: resetPool } = await import('./pool/WorkerPool');
  const { resetMessageBus: resetBus } = await import('./messaging/MessageBus');
  const { resetTaskQueue: resetQueue } = await import('./coordinator/TaskQueue');
  const { resetRateLimiter: resetLimiter } = await import('./coordinator/RateLimiter');
  const { resetConflictResolver: resetResolver } = await import('./conflict/ConflictResolver');
  const { resetValidationPipeline: resetPipeline } = await import('./validation/ValidationPipeline');

  resetCoord();
  resetPool();
  resetBus();
  resetQueue();
  resetLimiter();
  resetResolver();
  resetPipeline();
}
