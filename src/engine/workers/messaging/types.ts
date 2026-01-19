// Message Types for Agent Coordination System
// Defines all message types used for inter-agent and worker communication

import { ContentType, EnrichedData, DetectionResult } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';

// Agent identifiers
export type AgentId =
  | 'tv_series'
  | 'movie'
  | 'anime'
  | 'book'
  | 'game'
  | 'orchestrator'
  | 'coordinator'
  | 'validator';

// Message types for the coordination system
export type MessageType =
  // Detection messages
  | 'DETECTION_REQUEST'
  | 'DETECTION_RESPONSE'
  // Task lifecycle
  | 'TASK_ASSIGN'
  | 'TASK_COMPLETE'
  | 'TASK_FAILED'
  | 'TASK_PROGRESS'
  // Conflict resolution
  | 'CONFLICT_VOTE_REQUEST'
  | 'CONFLICT_VOTE_RESPONSE'
  | 'CONFLICT_RESOLVED'
  // Validation
  | 'VALIDATION_REQUEST'
  | 'VALIDATION_RESPONSE'
  // Worker status
  | 'WORKER_READY'
  | 'WORKER_BUSY'
  | 'WORKER_IDLE'
  | 'WORKER_ERROR'
  | 'WORKER_TERMINATED'
  // Rate limiting
  | 'RATE_LIMIT_CHECK'
  | 'RATE_LIMIT_RESPONSE'
  | 'RATE_LIMIT_EXCEEDED'
  // Cache operations
  | 'CACHE_GET'
  | 'CACHE_SET'
  | 'CACHE_RESPONSE';

// Worker status
export type WorkerStatus = 'initializing' | 'ready' | 'busy' | 'idle' | 'error' | 'terminated';

// Generic message envelope
export interface AgentMessage<T = unknown> {
  id: string;
  timestamp: number;
  source: AgentId | string;
  target?: AgentId | string | 'broadcast';
  type: MessageType;
  payload: T;
  correlationId?: string;
  priority?: 'high' | 'normal' | 'low';
}

// Detection request payload
export interface DetectionRequestPayload {
  cardId: string;
  context: DetectionContext;
}

// Detection response payload
export interface DetectionResponsePayload {
  cardId: string;
  result: DetectionResult;
  agentId: AgentId;
  processingTime: number;
}

// Task assignment payload
export interface TaskAssignPayload {
  taskId: string;
  cardId: string;
  title: string;
  year?: string;
  contentType: ContentType;
  context: DetectionContext;
  priority: 'high' | 'normal' | 'low';
}

// Task completion payload
export interface TaskCompletePayload {
  taskId: string;
  cardId: string;
  data: EnrichedData;
  agentId: AgentId;
  processingTime: number;
  cacheHit: boolean;
}

// Task failure payload
export interface TaskFailedPayload {
  taskId: string;
  cardId: string;
  error: string;
  agentId?: AgentId;
  retryable: boolean;
  attempts: number;
}

// Task progress payload
export interface TaskProgressPayload {
  taskId: string;
  cardId: string;
  stage: 'detecting' | 'resolving' | 'enriching' | 'validating';
  progress: number; // 0-100
  message?: string;
}

// Conflict vote request
export interface ConflictVoteRequestPayload {
  conflictId: string;
  cardId: string;
  claims: ConflictClaim[];
}

// A claim from an agent during conflict resolution
export interface ConflictClaim {
  agentId: AgentId;
  contentType: ContentType;
  confidence: number;
  signals: string[];
  metadata: Record<string, string | undefined>;
}

// Conflict vote response
export interface ConflictVoteResponsePayload {
  conflictId: string;
  voterId: AgentId;
  votedFor: AgentId;
  reason: string;
}

// Conflict resolution result
export interface ConflictResolvedPayload {
  conflictId: string;
  cardId: string;
  winner: ConflictClaim;
  method: 'confidence' | 'specificity' | 'signals' | 'voting';
  votes?: { agentId: AgentId; votedFor: AgentId }[];
}

// Validation request
export interface ValidationRequestPayload {
  cardId: string;
  data: EnrichedData;
  contentType: ContentType;
  source: AgentId;
}

// Validation response
export interface ValidationResponsePayload {
  cardId: string;
  valid: boolean;
  issues: ValidationIssue[];
  score: number; // 0-100 quality score
}

// Validation issue
export interface ValidationIssue {
  field: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

// Worker status payload
export interface WorkerStatusPayload {
  workerId: string;
  status: WorkerStatus;
  currentTask?: string;
  queueSize?: number;
  errorMessage?: string;
}

// Rate limit check payload
export interface RateLimitCheckPayload {
  api: string;
  requestCount?: number;
}

// Rate limit response payload
export interface RateLimitResponsePayload {
  api: string;
  allowed: boolean;
  remaining: number;
  resetIn: number; // milliseconds
}

// Cache operation payloads
export interface CacheGetPayload {
  key: string;
}

export interface CacheSetPayload {
  key: string;
  value: EnrichedData;
  ttl?: number;
}

export interface CacheResponsePayload {
  key: string;
  value: EnrichedData | null;
  hit: boolean;
}

// Enrichment task for the task queue
export interface EnrichmentTask {
  id: string;
  cardId: string;
  priority: 'high' | 'normal' | 'low';
  contentType: ContentType;
  title: string;
  year?: string;
  context: DetectionContext;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  assignedWorker?: string;
  error?: string;
}

// Subscription callback types
export type MessageCallback<T = unknown> = (message: AgentMessage<T>) => void;
export type UnsubscribeFn = () => void;

// Typed message helpers
export type DetectionRequestMessage = AgentMessage<DetectionRequestPayload>;
export type DetectionResponseMessage = AgentMessage<DetectionResponsePayload>;
export type TaskAssignMessage = AgentMessage<TaskAssignPayload>;
export type TaskCompleteMessage = AgentMessage<TaskCompletePayload>;
export type TaskFailedMessage = AgentMessage<TaskFailedPayload>;
export type ConflictVoteRequestMessage = AgentMessage<ConflictVoteRequestPayload>;
export type ConflictResolvedMessage = AgentMessage<ConflictResolvedPayload>;
export type ValidationRequestMessage = AgentMessage<ValidationRequestPayload>;
export type ValidationResponseMessage = AgentMessage<ValidationResponsePayload>;
