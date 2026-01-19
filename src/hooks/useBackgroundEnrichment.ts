// useBackgroundEnrichment - React hook for background content enrichment
// Uses Web Workers for parallel processing

import { useState, useEffect, useCallback, useRef } from 'react';
import { ContentType, EnrichedData, DetectionResult } from '../engine/types';
import {
  TaskCoordinator,
  getTaskCoordinator,
  initializeTaskCoordinator,
  TaskProgressPayload,
  EnrichmentTask,
  PoolStats,
  QueueStats,
} from '../engine/workers';

// Hook options
export interface UseBackgroundEnrichmentOptions {
  autoInitialize?: boolean;
  confidenceThreshold?: number;
  onError?: (error: Error) => void;
}

// Card submission result
export interface SubmitResult {
  taskId: string;
  cardId: string;
}

// Enrichment result for a card
export interface CardEnrichmentResult {
  cardId: string;
  success: boolean;
  detection?: DetectionResult;
  data?: EnrichedData;
  error?: string;
}

// Hook state
export interface UseBackgroundEnrichmentState {
  isReady: boolean;
  isInitializing: boolean;
  error: string | null;
  stats: {
    queue: QueueStats | null;
    pool: PoolStats | null;
  };
}

// Hook return type
export interface UseBackgroundEnrichmentReturn extends UseBackgroundEnrichmentState {
  // Initialize the background system
  initialize: () => Promise<void>;
  // Submit a card for background processing
  submitCard: (
    cardId: string,
    title: string,
    description?: string,
    listContext?: string,
    urls?: string[],
    checklistNames?: string[],
    priority?: 'high' | 'normal' | 'low'
  ) => SubmitResult;
  // Submit with known content type (skip detection)
  submitCardWithType: (
    cardId: string,
    title: string,
    contentType: ContentType,
    year?: string,
    priority?: 'high' | 'normal' | 'low'
  ) => SubmitResult;
  // Subscribe to card completion
  subscribeToCard: (
    cardId: string,
    onComplete: (data: EnrichedData, detection: DetectionResult) => void,
    onError?: (error: string) => void,
    onProgress?: (progress: TaskProgressPayload) => void
  ) => () => void;
  // Wait for card result (Promise-based)
  waitForCard: (cardId: string, timeoutMs?: number) => Promise<CardEnrichmentResult>;
  // Cancel a pending task
  cancelTask: (cardId: string) => boolean;
  // Update task priority
  updatePriority: (cardId: string, priority: 'high' | 'normal' | 'low') => boolean;
  // Get task status
  getTaskStatus: (cardId: string) => EnrichmentTask | null;
  // Refresh stats
  refreshStats: () => void;
}

export function useBackgroundEnrichment(
  options: UseBackgroundEnrichmentOptions = {}
): UseBackgroundEnrichmentReturn {
  const { autoInitialize = false, confidenceThreshold = 25, onError } = options;

  const [isReady, setIsReady] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    queue: QueueStats | null;
    pool: PoolStats | null;
  }>({ queue: null, pool: null });

  const coordinatorRef = useRef<TaskCoordinator | null>(null);
  const mountedRef = useRef(true);

  // Initialize the coordinator
  const initialize = useCallback(async () => {
    if (coordinatorRef.current?.isReady()) {
      setIsReady(true);
      return;
    }

    if (isInitializing) return;

    setIsInitializing(true);
    setError(null);

    try {
      const coordinator = await initializeTaskCoordinator({
        confidenceThreshold,
      });

      if (mountedRef.current) {
        coordinatorRef.current = coordinator;
        setIsReady(true);
        refreshStats();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize';
      if (mountedRef.current) {
        setError(errorMessage);
        onError?.(err instanceof Error ? err : new Error(errorMessage));
      }
    } finally {
      if (mountedRef.current) {
        setIsInitializing(false);
      }
    }
  }, [confidenceThreshold, isInitializing, onError]);

  // Auto-initialize if requested
  useEffect(() => {
    if (autoInitialize && !isReady && !isInitializing) {
      initialize();
    }
  }, [autoInitialize, isReady, isInitializing, initialize]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Refresh stats
  const refreshStats = useCallback(() => {
    const coordinator = coordinatorRef.current || getTaskCoordinator();
    if (coordinator.isReady()) {
      const currentStats = coordinator.getStats();
      setStats({
        queue: currentStats.queue,
        pool: currentStats.pool,
      });
    }
  }, []);

  // Submit a card for processing
  const submitCard = useCallback(
    (
      cardId: string,
      title: string,
      description?: string,
      listContext?: string,
      urls?: string[],
      checklistNames?: string[],
      priority: 'high' | 'normal' | 'low' = 'normal'
    ): SubmitResult => {
      const coordinator = coordinatorRef.current;
      if (!coordinator || !coordinator.isReady()) {
        throw new Error('Background enrichment not initialized');
      }

      const taskId = coordinator.submitCard(
        cardId,
        title,
        description,
        listContext,
        urls,
        checklistNames,
        priority
      );

      return { taskId, cardId };
    },
    []
  );

  // Submit with known type
  const submitCardWithType = useCallback(
    (
      cardId: string,
      title: string,
      contentType: ContentType,
      year?: string,
      priority: 'high' | 'normal' | 'low' = 'normal'
    ): SubmitResult => {
      const coordinator = coordinatorRef.current;
      if (!coordinator || !coordinator.isReady()) {
        throw new Error('Background enrichment not initialized');
      }

      const taskId = coordinator.submitCardWithType(
        cardId,
        title,
        contentType,
        year,
        priority
      );

      return { taskId, cardId };
    },
    []
  );

  // Subscribe to card updates
  const subscribeToCard = useCallback(
    (
      cardId: string,
      onComplete: (data: EnrichedData, detection: DetectionResult) => void,
      onErrorCallback?: (error: string) => void,
      onProgress?: (progress: TaskProgressPayload) => void
    ): (() => void) => {
      const coordinator = coordinatorRef.current;
      if (!coordinator) {
        return () => {};
      }

      const unsubscribers: (() => void)[] = [];

      unsubscribers.push(
        coordinator.onComplete(cardId, (id, data, detection) => {
          onComplete(data, detection);
        })
      );

      if (onErrorCallback) {
        unsubscribers.push(
          coordinator.onError(cardId, (id, error) => {
            onErrorCallback(error);
          })
        );
      }

      if (onProgress) {
        unsubscribers.push(
          coordinator.onProgress(cardId, (id, progress) => {
            onProgress(progress);
          })
        );
      }

      return () => {
        unsubscribers.forEach((unsub) => unsub());
      };
    },
    []
  );

  // Wait for card result
  const waitForCard = useCallback(
    async (cardId: string, timeoutMs?: number): Promise<CardEnrichmentResult> => {
      const coordinator = coordinatorRef.current;
      if (!coordinator || !coordinator.isReady()) {
        throw new Error('Background enrichment not initialized');
      }

      const result = await coordinator.waitForCard(cardId, timeoutMs);

      return {
        cardId: result.cardId,
        success: result.success,
        detection: result.detection,
        data: result.data,
        error: result.error,
      };
    },
    []
  );

  // Cancel a task
  const cancelTask = useCallback((cardId: string): boolean => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) return false;
    return coordinator.cancelTask(cardId);
  }, []);

  // Update priority
  const updatePriority = useCallback(
    (cardId: string, priority: 'high' | 'normal' | 'low'): boolean => {
      const coordinator = coordinatorRef.current;
      if (!coordinator) return false;
      return coordinator.updatePriority(cardId, priority);
    },
    []
  );

  // Get task status
  const getTaskStatus = useCallback((cardId: string): EnrichmentTask | null => {
    const coordinator = coordinatorRef.current;
    if (!coordinator) return null;
    return coordinator.getTaskStatus(cardId);
  }, []);

  return {
    isReady,
    isInitializing,
    error,
    stats,
    initialize,
    submitCard,
    submitCardWithType,
    subscribeToCard,
    waitForCard,
    cancelTask,
    updatePriority,
    getTaskStatus,
    refreshStats,
  };
}

export default useBackgroundEnrichment;
