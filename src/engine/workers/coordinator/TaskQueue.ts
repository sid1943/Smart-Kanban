// TaskQueue - Priority queue for enrichment tasks
// Manages task ordering and deduplication

import { EnrichmentTask } from '../messaging/types';
import { ContentType } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';

// Priority weights
const PRIORITY_WEIGHTS = {
  high: 0,
  normal: 1,
  low: 2,
};

// Task creation options
export interface CreateTaskOptions {
  cardId: string;
  title: string;
  contentType: ContentType;
  context: DetectionContext;
  year?: string;
  priority?: 'high' | 'normal' | 'low';
  maxAttempts?: number;
}

// Queue statistics
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  byPriority: { high: number; normal: number; low: number };
}

export class TaskQueue {
  private tasks: Map<string, EnrichmentTask> = new Map();
  private cardToTask: Map<string, string> = new Map();
  private maxQueueSize: number;
  private defaultMaxAttempts: number;

  constructor(options?: { maxQueueSize?: number; defaultMaxAttempts?: number }) {
    this.maxQueueSize = options?.maxQueueSize || 1000;
    this.defaultMaxAttempts = options?.defaultMaxAttempts || 3;
  }

  /**
   * Create and add a new task
   */
  createTask(options: CreateTaskOptions): EnrichmentTask {
    // Check if card already has a pending task
    const existingTaskId = this.cardToTask.get(options.cardId);
    if (existingTaskId) {
      const existingTask = this.tasks.get(existingTaskId);
      if (existingTask && existingTask.status === 'pending') {
        // Update priority if higher
        if (
          options.priority &&
          PRIORITY_WEIGHTS[options.priority] < PRIORITY_WEIGHTS[existingTask.priority]
        ) {
          existingTask.priority = options.priority;
        }
        return existingTask;
      }
    }

    // Check queue size limit
    if (this.tasks.size >= this.maxQueueSize) {
      // Remove oldest completed/failed tasks
      this.cleanup();

      if (this.tasks.size >= this.maxQueueSize) {
        throw new Error('Task queue is full');
      }
    }

    const taskId = this.generateTaskId();
    const task: EnrichmentTask = {
      id: taskId,
      cardId: options.cardId,
      title: options.title,
      contentType: options.contentType,
      context: options.context,
      year: options.year,
      priority: options.priority || 'normal',
      attempts: 0,
      maxAttempts: options.maxAttempts || this.defaultMaxAttempts,
      status: 'pending',
      createdAt: Date.now(),
    };

    this.tasks.set(taskId, task);
    this.cardToTask.set(options.cardId, taskId);

    return task;
  }

  /**
   * Get task by ID
   */
  getTask(taskId: string): EnrichmentTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get task by card ID
   */
  getTaskByCardId(cardId: string): EnrichmentTask | undefined {
    const taskId = this.cardToTask.get(cardId);
    return taskId ? this.tasks.get(taskId) : undefined;
  }

  /**
   * Get next pending task (highest priority, oldest first)
   */
  getNextTask(): EnrichmentTask | null {
    let best: EnrichmentTask | null = null;

    for (const task of this.tasks.values()) {
      if (task.status !== 'pending') continue;

      if (!best) {
        best = task;
        continue;
      }

      // Compare priority (lower weight = higher priority)
      const taskWeight = PRIORITY_WEIGHTS[task.priority];
      const bestWeight = PRIORITY_WEIGHTS[best.priority];

      if (taskWeight < bestWeight) {
        best = task;
      } else if (taskWeight === bestWeight && task.createdAt < best.createdAt) {
        // Same priority - older task first
        best = task;
      }
    }

    return best;
  }

  /**
   * Get multiple pending tasks
   */
  getPendingTasks(limit: number = 10): EnrichmentTask[] {
    const pending: EnrichmentTask[] = [];

    for (const task of this.tasks.values()) {
      if (task.status === 'pending') {
        pending.push(task);
      }
    }

    // Sort by priority then by creation time
    pending.sort((a, b) => {
      const aWeight = PRIORITY_WEIGHTS[a.priority];
      const bWeight = PRIORITY_WEIGHTS[b.priority];
      if (aWeight !== bWeight) return aWeight - bWeight;
      return a.createdAt - b.createdAt;
    });

    return pending.slice(0, limit);
  }

  /**
   * Mark task as processing
   */
  markProcessing(taskId: string, workerId?: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return false;

    task.status = 'processing';
    task.startedAt = Date.now();
    task.attempts++;
    if (workerId) {
      task.assignedWorker = workerId;
    }

    return true;
  }

  /**
   * Mark task as completed
   */
  markCompleted(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'processing') return false;

    task.status = 'completed';
    task.completedAt = Date.now();

    return true;
  }

  /**
   * Mark task as failed
   */
  markFailed(taskId: string, error: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    task.error = error;

    // Check if retryable
    if (task.attempts < task.maxAttempts) {
      task.status = 'pending';
      task.startedAt = undefined;
      task.assignedWorker = undefined;
    } else {
      task.status = 'failed';
      task.completedAt = Date.now();
    }

    return true;
  }

  /**
   * Remove a task
   */
  removeTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    this.tasks.delete(taskId);
    this.cardToTask.delete(task.cardId);

    return true;
  }

  /**
   * Cancel a task
   */
  cancelTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // Only cancel pending tasks
    if (task.status === 'pending') {
      task.status = 'failed';
      task.error = 'Cancelled';
      task.completedAt = Date.now();
      return true;
    }

    return false;
  }

  /**
   * Update task priority
   */
  updatePriority(taskId: string, priority: 'high' | 'normal' | 'low'): boolean {
    const task = this.tasks.get(taskId);
    if (!task || task.status !== 'pending') return false;

    task.priority = priority;
    return true;
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const stats: QueueStats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      byPriority: { high: 0, normal: 0, low: 0 },
    };

    for (const task of this.tasks.values()) {
      switch (task.status) {
        case 'pending':
          stats.pending++;
          stats.byPriority[task.priority]++;
          break;
        case 'processing':
          stats.processing++;
          break;
        case 'completed':
          stats.completed++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }
    }

    return stats;
  }

  /**
   * Get all tasks
   */
  getAllTasks(): EnrichmentTask[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Clear all tasks
   */
  clear(): void {
    this.tasks.clear();
    this.cardToTask.clear();
  }

  /**
   * Clean up old completed/failed tasks
   */
  cleanup(maxAge: number = 300000): number {
    const now = Date.now();
    let removed = 0;

    for (const [taskId, task] of this.tasks) {
      if (
        (task.status === 'completed' || task.status === 'failed') &&
        task.completedAt &&
        now - task.completedAt > maxAge
      ) {
        this.tasks.delete(taskId);
        this.cardToTask.delete(task.cardId);
        removed++;
      }
    }

    return removed;
  }

  // Generate unique task ID
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton instance
let defaultQueue: TaskQueue | null = null;

export function getTaskQueue(options?: {
  maxQueueSize?: number;
  defaultMaxAttempts?: number;
}): TaskQueue {
  if (!defaultQueue) {
    defaultQueue = new TaskQueue(options);
  }
  return defaultQueue;
}

export function resetTaskQueue(): void {
  if (defaultQueue) {
    defaultQueue.clear();
    defaultQueue = null;
  }
}

export default TaskQueue;
