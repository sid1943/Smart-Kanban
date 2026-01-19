// WorkerStatus - Visual indicator for background processing status
// Shows worker pool and queue statistics

import { useState, useEffect, useCallback } from 'react';
import { useBackgroundEnrichment } from '../hooks/useBackgroundEnrichment';
import { PoolStats, QueueStats } from '../engine/workers';

interface WorkerStatusProps {
  className?: string;
  showDetails?: boolean;
  refreshInterval?: number;
}

export function WorkerStatus({
  className = '',
  showDetails = false,
  refreshInterval = 2000,
}: WorkerStatusProps) {
  const { isReady, isInitializing, error, stats, refreshStats } = useBackgroundEnrichment({
    autoInitialize: true,
  });

  // Auto-refresh stats
  useEffect(() => {
    if (!isReady) return;

    const interval = setInterval(() => {
      refreshStats();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [isReady, refreshInterval, refreshStats]);

  // Calculate status
  const getStatus = useCallback(() => {
    if (error) return 'error';
    if (isInitializing) return 'initializing';
    if (!isReady) return 'offline';

    const queue = stats.queue;
    const pool = stats.pool;

    if (!queue || !pool) return 'unknown';

    if (queue.processing > 0 || pool.activeWorkers > 0) {
      return 'processing';
    }

    if (queue.pending > 0) {
      return 'queued';
    }

    return 'idle';
  }, [error, isInitializing, isReady, stats]);

  const status = getStatus();

  // Status colors
  const statusColors: Record<string, string> = {
    error: 'bg-red-500',
    initializing: 'bg-yellow-500 animate-pulse',
    offline: 'bg-gray-400',
    processing: 'bg-blue-500 animate-pulse',
    queued: 'bg-yellow-500',
    idle: 'bg-green-500',
    unknown: 'bg-gray-400',
  };

  // Status labels
  const statusLabels: Record<string, string> = {
    error: 'Error',
    initializing: 'Starting...',
    offline: 'Offline',
    processing: 'Processing',
    queued: 'Queued',
    idle: 'Ready',
    unknown: 'Unknown',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Status indicator dot */}
      <div
        className={`w-2 h-2 rounded-full ${statusColors[status]}`}
        title={`Workers: ${statusLabels[status]}`}
      />

      {/* Status text (optional) */}
      {showDetails && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <span className="font-medium">{statusLabels[status]}</span>

          {isReady && stats.queue && stats.pool && (
            <span className="ml-2 text-gray-500">
              {stats.queue.processing > 0 && (
                <span className="mr-2">
                  {stats.queue.processing} processing
                </span>
              )}
              {stats.queue.pending > 0 && (
                <span className="mr-2">
                  {stats.queue.pending} queued
                </span>
              )}
              {stats.pool.activeWorkers > 0 && (
                <span>
                  {stats.pool.activeWorkers}/{stats.pool.totalWorkers} workers
                </span>
              )}
            </span>
          )}

          {error && (
            <span className="ml-2 text-red-500" title={error}>
              {error.length > 20 ? error.substring(0, 20) + '...' : error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// Compact version for use in headers/toolbars
export function WorkerStatusBadge({ className = '' }: { className?: string }) {
  return <WorkerStatus className={className} showDetails={false} />;
}

// Detailed version for settings/debug panels
export function WorkerStatusPanel({ className = '' }: { className?: string }) {
  const { isReady, stats, refreshStats } = useBackgroundEnrichment({
    autoInitialize: true,
  });

  useEffect(() => {
    if (isReady) {
      const interval = setInterval(refreshStats, 1000);
      return () => clearInterval(interval);
    }
  }, [isReady, refreshStats]);

  if (!isReady || !stats.queue || !stats.pool) {
    return (
      <div className={`p-4 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
        <p className="text-gray-500">Worker system not initialized</p>
      </div>
    );
  }

  const { queue, pool } = stats;

  return (
    <div className={`p-4 bg-gray-100 dark:bg-gray-800 rounded-lg ${className}`}>
      <h3 className="text-sm font-semibold mb-3 text-gray-700 dark:text-gray-300">
        Background Workers
      </h3>

      <div className="grid grid-cols-2 gap-4 text-sm">
        {/* Worker Pool Stats */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">Workers</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Total</span>
              <span className="font-mono">{pool.totalWorkers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Active</span>
              <span className="font-mono text-blue-600">{pool.activeWorkers}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Idle</span>
              <span className="font-mono text-green-600">{pool.idleWorkers}</span>
            </div>
          </div>
        </div>

        {/* Queue Stats */}
        <div>
          <h4 className="text-xs font-medium text-gray-500 mb-1">Queue</h4>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Pending</span>
              <span className="font-mono">{queue.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Processing</span>
              <span className="font-mono text-blue-600">{queue.processing}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Completed</span>
              <span className="font-mono text-green-600">{queue.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Failed</span>
              <span className="font-mono text-red-600">{queue.failed}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Priority breakdown */}
      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-medium text-gray-500 mb-1">Pending by Priority</h4>
        <div className="flex gap-4 text-xs">
          <span className="text-red-600">
            High: {queue.byPriority.high}
          </span>
          <span className="text-yellow-600">
            Normal: {queue.byPriority.normal}
          </span>
          <span className="text-gray-600">
            Low: {queue.byPriority.low}
          </span>
        </div>
      </div>
    </div>
  );
}

export default WorkerStatus;
