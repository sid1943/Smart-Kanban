// WorkerPool - Manages a pool of Web Worker instances
// Handles load balancing and worker lifecycle

import { ContentType, EnrichedData, DetectionResult } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';
import { WorkerStatus } from '../messaging/types';
import { AgentWorker, WorkerDetectionResult, WorkerProcessResult } from './AgentWorker';

// Pool configuration
export interface WorkerPoolConfig {
  minWorkers: number;
  maxWorkers: number;
  idleTimeout: number;
  requestTimeout: number;
}

// Default configuration
const DEFAULT_CONFIG: WorkerPoolConfig = {
  minWorkers: 2,
  maxWorkers: 4,
  idleTimeout: 60000,
  requestTimeout: 60000,
};

// Worker info for pool management
interface PooledWorker {
  worker: AgentWorker;
  status: WorkerStatus;
  lastUsed: number;
  taskCount: number;
}

// Pool statistics
export interface PoolStats {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  pendingTasks: number;
  completedTasks: number;
  failedTasks: number;
}

// Task waiting for a worker
interface PendingTask<T> {
  id: string;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  execute: (worker: AgentWorker) => Promise<T>;
  createdAt: number;
}

export class WorkerPool {
  private config: WorkerPoolConfig;
  private workers: Map<string, PooledWorker> = new Map();
  private pendingTasks: PendingTask<unknown>[] = [];
  private initialized = false;
  private stats = {
    completedTasks: 0,
    failedTasks: 0,
  };
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private onWorkerStatusChange?: (workerId: string, status: WorkerStatus) => void;

  constructor(
    config?: Partial<WorkerPoolConfig>,
    onWorkerStatusChange?: (workerId: string, status: WorkerStatus) => void
  ) {
    // Determine optimal worker count based on hardware
    const hardwareConcurrency = typeof navigator !== 'undefined'
      ? navigator.hardwareConcurrency || 4
      : 4;

    const defaultConfig: WorkerPoolConfig = {
      ...DEFAULT_CONFIG,
      minWorkers: Math.min(2, hardwareConcurrency),
      maxWorkers: Math.min(4, hardwareConcurrency),
    };

    this.config = { ...defaultConfig, ...config };
    this.onWorkerStatusChange = onWorkerStatusChange;
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[WorkerPool] Already initialized');
      return;
    }

    console.log(`[WorkerPool] Initializing with ${this.config.minWorkers}-${this.config.maxWorkers} workers`);

    // Create minimum number of workers
    const initPromises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minWorkers; i++) {
      initPromises.push(this.createWorker());
    }

    await Promise.all(initPromises);

    // Start idle worker cleanup
    this.startIdleCheck();

    this.initialized = true;
    console.log(`[WorkerPool] Initialized with ${this.workers.size} workers`);
  }

  /**
   * Check if pool is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    let activeWorkers = 0;
    let idleWorkers = 0;

    for (const pooled of this.workers.values()) {
      if (pooled.status === 'busy') {
        activeWorkers++;
      } else if (pooled.status === 'idle' || pooled.status === 'ready') {
        idleWorkers++;
      }
    }

    return {
      totalWorkers: this.workers.size,
      activeWorkers,
      idleWorkers,
      pendingTasks: this.pendingTasks.length,
      completedTasks: this.stats.completedTasks,
      failedTasks: this.stats.failedTasks,
    };
  }

  /**
   * Run detection on an available worker
   */
  async detect(context: DetectionContext, taskId?: string): Promise<WorkerDetectionResult> {
    return this.executeTask<WorkerDetectionResult>(
      taskId || `detect_${Date.now()}`,
      (worker) => worker.detect(context, taskId)
    );
  }

  /**
   * Run enrichment on an available worker
   */
  async enrich(
    title: string,
    contentType: ContentType,
    year?: string,
    taskId?: string
  ): Promise<EnrichedData> {
    return this.executeTask<EnrichedData>(
      taskId || `enrich_${Date.now()}`,
      (worker) => worker.enrich(title, contentType, year, taskId)
    );
  }

  /**
   * Run combined detect and enrich
   */
  async detectAndEnrich(
    context: DetectionContext,
    confidenceThreshold?: number,
    taskId?: string
  ): Promise<WorkerProcessResult> {
    return this.executeTask<WorkerProcessResult>(
      taskId || `process_${Date.now()}`,
      (worker) => worker.detectAndEnrich(context, confidenceThreshold, taskId)
    );
  }

  /**
   * Execute multiple tasks in parallel
   */
  async detectAll(
    contexts: DetectionContext[]
  ): Promise<Array<{ context: DetectionContext; result: WorkerDetectionResult }>> {
    const promises = contexts.map(async (context, index) => {
      const result = await this.detect(context, `detect_batch_${index}`);
      return { context, result };
    });

    return Promise.all(promises);
  }

  /**
   * Shutdown the pool
   */
  async shutdown(): Promise<void> {
    console.log('[WorkerPool] Shutting down...');

    // Stop idle check
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }

    // Reject pending tasks
    for (const task of this.pendingTasks) {
      task.reject(new Error('Worker pool shutting down'));
    }
    this.pendingTasks = [];

    // Terminate all workers
    for (const pooled of this.workers.values()) {
      pooled.worker.terminate();
    }
    this.workers.clear();

    this.initialized = false;
    console.log('[WorkerPool] Shutdown complete');
  }

  /**
   * Scale up workers (up to max)
   */
  async scaleUp(count: number = 1): Promise<void> {
    const toCreate = Math.min(
      count,
      this.config.maxWorkers - this.workers.size
    );

    for (let i = 0; i < toCreate; i++) {
      await this.createWorker();
    }
  }

  /**
   * Scale down workers (to min)
   */
  scaleDown(count: number = 1): void {
    const idleWorkers = Array.from(this.workers.entries())
      .filter(([, pooled]) => pooled.status === 'idle' || pooled.status === 'ready')
      .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = Math.min(
      count,
      idleWorkers.length,
      this.workers.size - this.config.minWorkers
    );

    for (let i = 0; i < toRemove; i++) {
      const [workerId, pooled] = idleWorkers[i];
      pooled.worker.terminate();
      this.workers.delete(workerId);
      console.log(`[WorkerPool] Removed worker: ${workerId}`);
    }
  }

  // Create a new worker
  private async createWorker(): Promise<void> {
    const worker = new AgentWorker({
      defaultTimeout: this.config.requestTimeout,
      onStatusChange: (status) => {
        const pooled = Array.from(this.workers.values()).find(
          (p) => p.worker === worker
        );
        if (pooled) {
          pooled.status = status;
          if (this.onWorkerStatusChange) {
            this.onWorkerStatusChange(worker.getId(), status);
          }
          // Process pending tasks when worker becomes available
          if (status === 'idle' || status === 'ready') {
            this.processPendingTasks();
          }
        }
      },
    });

    await worker.initialize();

    const pooled: PooledWorker = {
      worker,
      status: 'ready',
      lastUsed: Date.now(),
      taskCount: 0,
    };

    this.workers.set(worker.getId(), pooled);
    console.log(`[WorkerPool] Created worker: ${worker.getId()}`);
  }

  // Get an available worker
  private getAvailableWorker(): PooledWorker | null {
    // Find idle worker with lowest task count
    let best: PooledWorker | null = null;

    for (const pooled of this.workers.values()) {
      if (pooled.status === 'idle' || pooled.status === 'ready') {
        if (!best || pooled.taskCount < best.taskCount) {
          best = pooled;
        }
      }
    }

    return best;
  }

  // Execute a task on an available worker
  private async executeTask<T>(
    taskId: string,
    execute: (worker: AgentWorker) => Promise<T>
  ): Promise<T> {
    // Try to get an available worker
    const pooled = this.getAvailableWorker();

    if (pooled) {
      return this.runTask(pooled, execute);
    }

    // Scale up if possible
    if (this.workers.size < this.config.maxWorkers) {
      await this.scaleUp(1);
      const newPooled = this.getAvailableWorker();
      if (newPooled) {
        return this.runTask(newPooled, execute);
      }
    }

    // Queue the task
    return new Promise<T>((resolve, reject) => {
      this.pendingTasks.push({
        id: taskId,
        resolve: resolve as (value: unknown) => void,
        reject,
        execute: execute as (worker: AgentWorker) => Promise<unknown>,
        createdAt: Date.now(),
      });
    });
  }

  // Run a task on a specific worker
  private async runTask<T>(
    pooled: PooledWorker,
    execute: (worker: AgentWorker) => Promise<T>
  ): Promise<T> {
    pooled.lastUsed = Date.now();
    pooled.taskCount++;

    try {
      const result = await execute(pooled.worker);
      this.stats.completedTasks++;
      return result;
    } catch (error) {
      this.stats.failedTasks++;
      throw error;
    }
  }

  // Process pending tasks when workers become available
  private processPendingTasks(): void {
    while (this.pendingTasks.length > 0) {
      const pooled = this.getAvailableWorker();
      if (!pooled) break;

      const task = this.pendingTasks.shift()!;
      this.runTask(pooled, task.execute)
        .then(task.resolve)
        .catch(task.reject);
    }
  }

  // Start idle worker cleanup interval
  private startIdleCheck(): void {
    this.idleCheckInterval = setInterval(() => {
      const now = Date.now();

      for (const [workerId, pooled] of this.workers) {
        // Skip if we're at minimum workers
        if (this.workers.size <= this.config.minWorkers) break;

        // Check if worker has been idle too long
        if (
          (pooled.status === 'idle' || pooled.status === 'ready') &&
          now - pooled.lastUsed > this.config.idleTimeout
        ) {
          console.log(`[WorkerPool] Removing idle worker: ${workerId}`);
          pooled.worker.terminate();
          this.workers.delete(workerId);
        }
      }
    }, this.config.idleTimeout / 2);
  }
}

// Singleton instance
let defaultPool: WorkerPool | null = null;

export function getWorkerPool(
  config?: Partial<WorkerPoolConfig>,
  onWorkerStatusChange?: (workerId: string, status: WorkerStatus) => void
): WorkerPool {
  if (!defaultPool) {
    defaultPool = new WorkerPool(config, onWorkerStatusChange);
  }
  return defaultPool;
}

export async function initializeWorkerPool(
  config?: Partial<WorkerPoolConfig>,
  onWorkerStatusChange?: (workerId: string, status: WorkerStatus) => void
): Promise<WorkerPool> {
  const pool = getWorkerPool(config, onWorkerStatusChange);
  if (!pool.isInitialized()) {
    await pool.initialize();
  }
  return pool;
}

export function resetWorkerPool(): void {
  if (defaultPool) {
    defaultPool.shutdown();
    defaultPool = null;
  }
}

export default WorkerPool;
