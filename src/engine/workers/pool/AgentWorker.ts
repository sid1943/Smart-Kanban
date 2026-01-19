// AgentWorker - Wrapper class for Web Worker instances
// Provides promise-based interface for worker communication

import { ContentType, EnrichedData, DetectionResult } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';
import { WorkerStatus } from '../messaging/types';

// Worker message types
type WorkerMessageType =
  | 'INIT'
  | 'DETECT'
  | 'ENRICH'
  | 'DETECT_AND_ENRICH'
  | 'PING'
  | 'STATUS';

interface WorkerRequest {
  id: string;
  type: WorkerMessageType;
  payload: unknown;
}

interface WorkerResponse {
  id: string;
  type: WorkerMessageType;
  success: boolean;
  payload?: unknown;
  error?: string;
  processingTime?: number;
}

// Detection result from worker
export interface WorkerDetectionResult {
  winner: {
    type: ContentType;
    confidence: number;
    signals: string[];
    metadata: Record<string, string | undefined>;
    agent: string;
  };
  allResults: Array<{
    type: ContentType;
    confidence: number;
    agent: string;
  }>;
}

// Combined detect and enrich result
export interface WorkerProcessResult {
  detection: DetectionResult;
  data: EnrichedData;
}

// Worker status info
export interface WorkerStatusInfo {
  workerId: string;
  initialized: boolean;
  agentCount: number;
  agents: Array<{
    name: string;
    type: ContentType;
    enabled: boolean;
  }>;
}

// Pending request tracker
interface PendingRequest<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  startTime: number;
  timeout: ReturnType<typeof setTimeout>;
}

export class AgentWorker {
  private worker: Worker | null = null;
  private id: string;
  private status: WorkerStatus = 'initializing';
  private pendingRequests: Map<string, PendingRequest> = new Map();
  private currentTaskId: string | null = null;
  private defaultTimeout: number;
  private messageIdCounter = 0;
  private onStatusChange?: (status: WorkerStatus) => void;

  constructor(options?: {
    id?: string;
    defaultTimeout?: number;
    onStatusChange?: (status: WorkerStatus) => void;
  }) {
    this.id = options?.id || `worker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.defaultTimeout = options?.defaultTimeout || 60000;
    this.onStatusChange = options?.onStatusChange;
  }

  /**
   * Get worker ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get current status
   */
  getStatus(): WorkerStatus {
    return this.status;
  }

  /**
   * Get current task ID (if busy)
   */
  getCurrentTaskId(): string | null {
    return this.currentTaskId;
  }

  /**
   * Check if worker is available for work
   */
  isAvailable(): boolean {
    return this.status === 'ready' || this.status === 'idle';
  }

  /**
   * Initialize the worker
   */
  async initialize(): Promise<void> {
    if (this.worker) {
      throw new Error('Worker already initialized');
    }

    this.setStatus('initializing');

    // Create worker using Vite's worker import
    this.worker = new Worker(
      new URL('./agentWorker.worker.ts', import.meta.url),
      { type: 'module' }
    );

    // Set up message handler
    this.worker.onmessage = this.handleMessage.bind(this);
    this.worker.onerror = this.handleError.bind(this);

    // Initialize the worker
    await this.sendRequest<{ workerId: string; agentCount: number }>('INIT', {
      workerId: this.id,
    });

    this.setStatus('ready');
    console.log(`[AgentWorker ${this.id}] Initialized successfully`);
  }

  /**
   * Run detection on context
   */
  async detect(context: DetectionContext, taskId?: string): Promise<WorkerDetectionResult> {
    this.ensureReady();
    this.startTask(taskId);

    try {
      const result = await this.sendRequest<WorkerDetectionResult>('DETECT', { context });
      return result;
    } finally {
      this.endTask();
    }
  }

  /**
   * Run enrichment for a title
   */
  async enrich(
    title: string,
    contentType: ContentType,
    year?: string,
    taskId?: string
  ): Promise<EnrichedData> {
    this.ensureReady();
    this.startTask(taskId);

    try {
      const result = await this.sendRequest<EnrichedData>('ENRICH', {
        title,
        contentType,
        year,
      });
      return result;
    } finally {
      this.endTask();
    }
  }

  /**
   * Combined detect and enrich
   */
  async detectAndEnrich(
    context: DetectionContext,
    confidenceThreshold?: number,
    taskId?: string
  ): Promise<WorkerProcessResult> {
    this.ensureReady();
    this.startTask(taskId);

    try {
      const result = await this.sendRequest<WorkerProcessResult>('DETECT_AND_ENRICH', {
        context,
        confidenceThreshold,
      });
      return result;
    } finally {
      this.endTask();
    }
  }

  /**
   * Ping the worker
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.sendRequest<{ pong: boolean }>('PING', {}, 5000);
      return result.pong === true;
    } catch {
      return false;
    }
  }

  /**
   * Get worker status info
   */
  async getStatusInfo(): Promise<WorkerStatusInfo> {
    return this.sendRequest<WorkerStatusInfo>('STATUS', {});
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Worker terminated'));
    }
    this.pendingRequests.clear();

    // Terminate the worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.setStatus('terminated');
    console.log(`[AgentWorker ${this.id}] Terminated`);
  }

  // Generate unique message ID
  private generateMessageId(): string {
    return `${this.id}_${++this.messageIdCounter}_${Date.now()}`;
  }

  // Send request to worker
  private sendRequest<T>(
    type: WorkerMessageType,
    payload: unknown,
    timeout?: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.worker) {
        reject(new Error('Worker not initialized'));
        return;
      }

      const messageId = this.generateMessageId();
      const timeoutMs = timeout || this.defaultTimeout;

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Worker request timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(messageId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        startTime: Date.now(),
        timeout: timeoutHandle,
      });

      const request: WorkerRequest = {
        id: messageId,
        type,
        payload,
      };

      this.worker.postMessage(request);
    });
  }

  // Handle messages from worker
  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const { id, success, payload, error } = event.data;

    const pending = this.pendingRequests.get(id);
    if (!pending) {
      // Might be an unsolicited status message
      return;
    }

    this.pendingRequests.delete(id);
    clearTimeout(pending.timeout);

    if (success) {
      pending.resolve(payload);
    } else {
      pending.reject(new Error(error || 'Unknown worker error'));
    }
  }

  // Handle worker errors
  private handleError(event: ErrorEvent): void {
    console.error(`[AgentWorker ${this.id}] Error:`, event.message);
    this.setStatus('error');

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(`Worker error: ${event.message}`));
      this.pendingRequests.delete(id);
    }
  }

  // Ensure worker is ready
  private ensureReady(): void {
    if (!this.worker) {
      throw new Error('Worker not initialized');
    }
    if (this.status === 'terminated') {
      throw new Error('Worker has been terminated');
    }
    if (this.status === 'error') {
      throw new Error('Worker is in error state');
    }
  }

  // Start a task
  private startTask(taskId?: string): void {
    this.currentTaskId = taskId || null;
    this.setStatus('busy');
  }

  // End a task
  private endTask(): void {
    this.currentTaskId = null;
    this.setStatus('idle');
  }

  // Set status and notify
  private setStatus(status: WorkerStatus): void {
    const previousStatus = this.status;
    this.status = status;

    if (previousStatus !== status && this.onStatusChange) {
      this.onStatusChange(status);
    }
  }
}

export default AgentWorker;
