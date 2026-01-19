// TaskCoordinator - Orchestrates task execution across workers
// Manages the task queue, worker pool, and rate limiting

import { ContentType, EnrichedData, DetectionResult } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';
import {
  EnrichmentTask,
  TaskCompletePayload,
  TaskFailedPayload,
  TaskProgressPayload,
} from '../messaging/types';
import { MessageBus, getMessageBus } from '../messaging/MessageBus';
import { WorkerPool, initializeWorkerPool } from '../pool/WorkerPool';
import { TaskQueue, getTaskQueue, CreateTaskOptions } from './TaskQueue';
import { RateLimiter, getRateLimiter } from './RateLimiter';

// Coordinator configuration
export interface CoordinatorConfig {
  autoProcess: boolean;
  processInterval: number;
  batchSize: number;
  confidenceThreshold: number;
}

// Default configuration
const DEFAULT_CONFIG: CoordinatorConfig = {
  autoProcess: true,
  processInterval: 100,
  batchSize: 4,
  confidenceThreshold: 25,
};

// Subscription callback types
export type TaskCompletionCallback = (
  cardId: string,
  data: EnrichedData,
  detection: DetectionResult
) => void;
export type TaskErrorCallback = (cardId: string, error: string) => void;
export type TaskProgressCallback = (
  cardId: string,
  progress: TaskProgressPayload
) => void;

// Task result
export interface TaskResult {
  cardId: string;
  success: boolean;
  detection?: DetectionResult;
  data?: EnrichedData;
  error?: string;
  processingTime: number;
}

export class TaskCoordinator {
  private config: CoordinatorConfig;
  private bus: MessageBus;
  private pool: WorkerPool | null = null;
  private queue: TaskQueue;
  private rateLimiter: RateLimiter;
  private processing = false;
  private processInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private completionCallbacks: Map<string, TaskCompletionCallback[]> = new Map();
  private errorCallbacks: Map<string, TaskErrorCallback[]> = new Map();
  private progressCallbacks: Map<string, TaskProgressCallback[]> = new Map();
  private processingTasks: Set<string> = new Set();

  constructor(config?: Partial<CoordinatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bus = getMessageBus();
    this.queue = getTaskQueue();
    this.rateLimiter = getRateLimiter();
  }

  /**
   * Initialize the coordinator
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[TaskCoordinator] Already initialized');
      return;
    }

    console.log('[TaskCoordinator] Initializing...');

    // Initialize worker pool
    this.pool = await initializeWorkerPool(undefined, (workerId, status) => {
      console.log(`[TaskCoordinator] Worker ${workerId} status: ${status}`);
    });

    // Start auto-processing if enabled
    if (this.config.autoProcess) {
      this.startProcessing();
    }

    this.initialized = true;
    console.log('[TaskCoordinator] Initialized');
  }

  /**
   * Check if coordinator is ready
   */
  isReady(): boolean {
    return this.initialized && this.pool !== null;
  }

  /**
   * Submit a card for processing
   */
  submitCard(
    cardId: string,
    title: string,
    description?: string,
    listContext?: string,
    urls?: string[],
    checklistNames?: string[],
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const context: DetectionContext = {
      title,
      description,
      listContext,
      urls,
      checklistNames,
    };

    const taskOptions: CreateTaskOptions = {
      cardId,
      title,
      contentType: 'unknown',
      context,
      priority,
    };

    const task = this.queue.createTask(taskOptions);
    console.log(`[TaskCoordinator] Submitted task ${task.id} for card ${cardId}`);

    return task.id;
  }

  /**
   * Submit with known content type (skip detection)
   */
  submitCardWithType(
    cardId: string,
    title: string,
    contentType: ContentType,
    year?: string,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    const context: DetectionContext = { title };
    const taskOptions: CreateTaskOptions = {
      cardId,
      title,
      contentType,
      context,
      year,
      priority,
    };

    const task = this.queue.createTask(taskOptions);
    console.log(`[TaskCoordinator] Submitted typed task ${task.id} for card ${cardId}`);

    return task.id;
  }

  /**
   * Subscribe to task completion
   */
  onComplete(cardId: string, callback: TaskCompletionCallback): () => void {
    if (!this.completionCallbacks.has(cardId)) {
      this.completionCallbacks.set(cardId, []);
    }
    this.completionCallbacks.get(cardId)!.push(callback);

    return () => {
      const callbacks = this.completionCallbacks.get(cardId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to task errors
   */
  onError(cardId: string, callback: TaskErrorCallback): () => void {
    if (!this.errorCallbacks.has(cardId)) {
      this.errorCallbacks.set(cardId, []);
    }
    this.errorCallbacks.get(cardId)!.push(callback);

    return () => {
      const callbacks = this.errorCallbacks.get(cardId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to task progress
   */
  onProgress(cardId: string, callback: TaskProgressCallback): () => void {
    if (!this.progressCallbacks.has(cardId)) {
      this.progressCallbacks.set(cardId, []);
    }
    this.progressCallbacks.get(cardId)!.push(callback);

    return () => {
      const callbacks = this.progressCallbacks.get(cardId);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Subscribe to a card and get results via Promise
   */
  async waitForCard(cardId: string, timeoutMs: number = 60000): Promise<TaskResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribeComplete();
        unsubscribeError();
        reject(new Error(`Timeout waiting for card ${cardId}`));
      }, timeoutMs);

      const startTime = Date.now();

      const unsubscribeComplete = this.onComplete(cardId, (id, data, detection) => {
        clearTimeout(timeout);
        unsubscribeComplete();
        unsubscribeError();
        resolve({
          cardId: id,
          success: true,
          detection,
          data,
          processingTime: Date.now() - startTime,
        });
      });

      const unsubscribeError = this.onError(cardId, (id, error) => {
        clearTimeout(timeout);
        unsubscribeComplete();
        unsubscribeError();
        resolve({
          cardId: id,
          success: false,
          error,
          processingTime: Date.now() - startTime,
        });
      });
    });
  }

  /**
   * Cancel a task
   */
  cancelTask(cardId: string): boolean {
    const task = this.queue.getTaskByCardId(cardId);
    if (!task) return false;

    return this.queue.cancelTask(task.id);
  }

  /**
   * Update task priority
   */
  updatePriority(cardId: string, priority: 'high' | 'normal' | 'low'): boolean {
    const task = this.queue.getTaskByCardId(cardId);
    if (!task) return false;

    return this.queue.updatePriority(task.id, priority);
  }

  /**
   * Get task status
   */
  getTaskStatus(
    cardId: string
  ): EnrichmentTask | null {
    return this.queue.getTaskByCardId(cardId) || null;
  }

  /**
   * Get coordinator statistics
   */
  getStats(): {
    queue: ReturnType<TaskQueue['getStats']>;
    pool: ReturnType<WorkerPool['getStats']> | null;
    rateLimits: ReturnType<RateLimiter['getStatus']>;
  } {
    return {
      queue: this.queue.getStats(),
      pool: this.pool?.getStats() || null,
      rateLimits: this.rateLimiter.getStatus(),
    };
  }

  /**
   * Start auto-processing
   */
  startProcessing(): void {
    if (this.processInterval) return;

    this.processing = true;
    this.processInterval = setInterval(() => {
      this.processBatch();
    }, this.config.processInterval);

    console.log('[TaskCoordinator] Started auto-processing');
  }

  /**
   * Stop auto-processing
   */
  stopProcessing(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
    }
    this.processing = false;
    console.log('[TaskCoordinator] Stopped auto-processing');
  }

  /**
   * Process a single batch of tasks
   */
  async processBatch(): Promise<void> {
    if (!this.pool || !this.initialized) return;

    const stats = this.pool.getStats();
    const availableSlots = stats.idleWorkers;
    if (availableSlots === 0) return;

    // Get pending tasks
    const tasks = this.queue.getPendingTasks(
      Math.min(availableSlots, this.config.batchSize)
    );

    if (tasks.length === 0) return;

    // Process tasks in parallel
    const promises = tasks.map((task) => this.processTask(task));
    await Promise.allSettled(promises);
  }

  /**
   * Shutdown the coordinator
   */
  async shutdown(): Promise<void> {
    console.log('[TaskCoordinator] Shutting down...');

    this.stopProcessing();

    if (this.pool) {
      await this.pool.shutdown();
      this.pool = null;
    }

    this.completionCallbacks.clear();
    this.errorCallbacks.clear();
    this.progressCallbacks.clear();
    this.processingTasks.clear();

    this.initialized = false;
    console.log('[TaskCoordinator] Shutdown complete');
  }

  // Process a single task
  private async processTask(task: EnrichmentTask): Promise<void> {
    if (!this.pool) return;
    if (this.processingTasks.has(task.id)) return;

    this.processingTasks.add(task.id);
    this.queue.markProcessing(task.id);

    const startTime = Date.now();

    try {
      // Notify progress - detecting
      this.notifyProgress(task.cardId, {
        taskId: task.id,
        cardId: task.cardId,
        stage: 'detecting',
        progress: 10,
      });

      // Run detection and enrichment
      const result = await this.pool.detectAndEnrich(
        task.context,
        this.config.confidenceThreshold,
        task.id
      );

      // Notify progress - validating
      this.notifyProgress(task.cardId, {
        taskId: task.id,
        cardId: task.cardId,
        stage: 'validating',
        progress: 90,
      });

      // Mark as completed
      this.queue.markCompleted(task.id);

      // Notify completion
      this.notifyCompletion(task.cardId, result.data, result.detection);

      // Publish completion message
      this.bus.publish<TaskCompletePayload>({
        type: 'TASK_COMPLETE',
        source: 'coordinator',
        payload: {
          taskId: task.id,
          cardId: task.cardId,
          data: result.data,
          agentId: 'orchestrator',
          processingTime: Date.now() - startTime,
          cacheHit: false,
        },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark as failed (may retry)
      this.queue.markFailed(task.id, errorMessage);

      const updatedTask = this.queue.getTask(task.id);
      const isFinalFailure = updatedTask?.status === 'failed';

      if (isFinalFailure) {
        // Notify error
        this.notifyError(task.cardId, errorMessage);

        // Publish failure message
        this.bus.publish<TaskFailedPayload>({
          type: 'TASK_FAILED',
          source: 'coordinator',
          payload: {
            taskId: task.id,
            cardId: task.cardId,
            error: errorMessage,
            retryable: false,
            attempts: task.attempts + 1,
          },
        });
      }
    } finally {
      this.processingTasks.delete(task.id);
    }
  }

  // Notify completion callbacks
  private notifyCompletion(
    cardId: string,
    data: EnrichedData,
    detection: DetectionResult
  ): void {
    const callbacks = this.completionCallbacks.get(cardId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(cardId, data, detection);
        } catch (error) {
          console.error('[TaskCoordinator] Completion callback error:', error);
        }
      }
    }
  }

  // Notify error callbacks
  private notifyError(cardId: string, error: string): void {
    const callbacks = this.errorCallbacks.get(cardId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(cardId, error);
        } catch (err) {
          console.error('[TaskCoordinator] Error callback error:', err);
        }
      }
    }
  }

  // Notify progress callbacks
  private notifyProgress(cardId: string, progress: TaskProgressPayload): void {
    const callbacks = this.progressCallbacks.get(cardId);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(cardId, progress);
        } catch (error) {
          console.error('[TaskCoordinator] Progress callback error:', error);
        }
      }
    }
  }
}

// Singleton instance
let defaultCoordinator: TaskCoordinator | null = null;

export function getTaskCoordinator(
  config?: Partial<CoordinatorConfig>
): TaskCoordinator {
  if (!defaultCoordinator) {
    defaultCoordinator = new TaskCoordinator(config);
  }
  return defaultCoordinator;
}

export async function initializeTaskCoordinator(
  config?: Partial<CoordinatorConfig>
): Promise<TaskCoordinator> {
  const coordinator = getTaskCoordinator(config);
  if (!coordinator.isReady()) {
    await coordinator.initialize();
  }
  return coordinator;
}

export function resetTaskCoordinator(): void {
  if (defaultCoordinator) {
    defaultCoordinator.shutdown();
    defaultCoordinator = null;
  }
}

export default TaskCoordinator;
