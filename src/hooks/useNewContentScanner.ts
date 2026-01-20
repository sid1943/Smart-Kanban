// Background scanner for detecting new content across all content types
// Uses the NewContentOrchestrator to handle type-specific detection

import { useState, useEffect, useCallback } from 'react';
import { ContentType, UpcomingContent, EnrichedData } from '../engine/types';
import { Checklist, TaskItem } from '../types/tasks';

// Cached enrichment structure
interface CachedEnrichment {
  data: EnrichedData;
  fetchedAt: string;
}
import { getOrchestrator } from '../engine/agents/AgentOrchestrator';
import {
  getNewContentOrchestrator,
  ChecklistInfo,
} from '../engine/detection';

interface TaskItemWithCache extends TaskItem {
  cachedEnrichment?: CachedEnrichment;
}

interface ScanResult {
  taskId: string;
  hasNewContent: boolean;
  upcomingContent?: UpcomingContent;
  showStatus?: 'ongoing' | 'ended' | 'upcoming';
  debug?: {
    reason: string;
    comparison?: string;
  };
}

const MAX_RESULTS = 200;

// Cache duration: 24 hours in milliseconds
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

// Check if cache is still valid (less than 24 hours old)
function isCacheValid(cachedEnrichment?: CachedEnrichment): boolean {
  if (!cachedEnrichment?.fetchedAt) return false;
  const fetchedAt = new Date(cachedEnrichment.fetchedAt).getTime();
  const now = Date.now();
  return now - fetchedAt < CACHE_DURATION_MS;
}

// Extract year from title like "Show Name (2019- )" or "Show Name (2019)"
function extractYear(title: string): string | undefined {
  const match = title.match(/\((\d{4})/);
  return match ? match[1] : undefined;
}

// Clean title by removing year suffix
function cleanTitle(title: string): string {
  return title.replace(/\s*\(\d{4}[^)]*\)\s*$/, '').trim();
}

// Convert task checklists to the format expected by detection strategies
function toChecklistInfo(checklists?: Checklist[]): ChecklistInfo[] {
  if (!checklists) return [];
  return checklists.map((cl) => ({
    name: cl.name,
    items: cl.items.map((item) => ({
      text: item.text,
      checked: item.checked,
    })),
  }));
}

// Check if a task can be scanned/enriched
function isScannableTask(task: TaskItem): boolean {
  // Must have a recognized content type
  const scannableTypes: ContentType[] = ['tv_series', 'anime', 'movie', 'book', 'game'];
  if (!task.contentType || !scannableTypes.includes(task.contentType)) {
    return false;
  }
  return true;
}

// Check if task needs new content detection (has season checklists for TV/anime)
function needsNewContentCheck(task: TaskItem): boolean {
  if (task.contentType === 'tv_series' || task.contentType === 'anime') {
    if (!task.checklists || task.checklists.length === 0) return false;
    return task.checklists.some(
      (cl) =>
        cl.name.toLowerCase().includes('season') ||
        cl.items.some((item) => /season\s*\d+/i.test(item.text))
    );
  }
  // For movies, books, games - always check for new content (sequels, etc.)
  return true;
}

// Yield to allow UI to update (prevents lag)
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function useNewContentScanner(
  tasks: TaskItemWithCache[],
  onUpdateTask: (taskId: string, updates: Partial<TaskItem>) => void,
  enabled: boolean = true
) {
  const [scanning, setScanning] = useState(false);
  const [scannedCount, setScannedCount] = useState(0);
  const [totalToScan, setTotalToScan] = useState(0);
  const [results, setResults] = useState<ScanResult[]>([]);

  const scanTasks = useCallback(async (isManualTrigger: boolean = false) => {
    if (scanning) return;
    // For manual trigger (button click), always run. For auto-scan, check enabled.
    if (!enabled && !isManualTrigger) return;

    // Filter to scannable tasks (any task with a valid content type)
    const scannableTasks = tasks.filter(isScannableTask);
    if (scannableTasks.length === 0) return;

    // Determine which tasks need processing
    // - Tasks with no cache always need processing
    // - Tasks with stale cache (> 24 hours) need API refresh
    // - Tasks with valid cache only need detection re-run (no API call)
    const tasksToProcess = scannableTasks.filter(
      (task) => !task.cachedEnrichment || needsNewContentCheck(task)
    );
    if (tasksToProcess.length === 0) return;

    setScanning(true);
    setTotalToScan(tasksToProcess.length);
    setScannedCount(0);
    setResults([]);

    const newResults: ScanResult[] = [];
    const agentOrchestrator = getOrchestrator();
    const newContentOrchestrator = getNewContentOrchestrator();

    for (let i = 0; i < tasksToProcess.length; i++) {
      const task = tasksToProcess[i];

      try {
        const title = cleanTitle(task.text);
        const year = extractYear(task.text);

        // Check cache validity
        const cacheIsValid = isCacheValid(task.cachedEnrichment);

        // Use cached data if valid, otherwise fetch from API
        let enrichedData: EnrichedData = null;
        let needsApiCall = false;

        if (cacheIsValid && task.cachedEnrichment?.data) {
          // Cache is valid (< 24 hours old), use it
          enrichedData = task.cachedEnrichment.data;
        } else {
          // Cache is stale or missing, need API call
          needsApiCall = true;
          enrichedData = await agentOrchestrator.enrich(
            title,
            task.contentType!,
            year
          );
        }

        if (enrichedData) {
          // Build update object
          const updates: Partial<TaskItem> = {};

          // Update cache if we just fetched from API
          if (needsApiCall) {
            updates.cachedEnrichment = {
              data: enrichedData,
              fetchedAt: new Date().toISOString(),
            };
          }

          // Run new content detection if applicable
          if (needsNewContentCheck(task)) {
            const detectionResult = newContentOrchestrator.detect({
              taskId: task.id,
              title,
              contentType: task.contentType!,
              enrichedData,
              checklists: toChecklistInfo(task.checklists),
            });

            newResults.push({
              taskId: task.id,
              hasNewContent: detectionResult.hasNewContent,
              upcomingContent: detectionResult.upcomingContent,
              showStatus: detectionResult.status,
              debug: detectionResult.debug,
            });

            if (detectionResult.hasNewContent !== task.hasNewContent) {
              updates.hasNewContent = detectionResult.hasNewContent;
            }

            if (detectionResult.upcomingContent) {
              const current = task.upcomingContent;
              const next = detectionResult.upcomingContent;
              if (
                !current ||
                current.title !== next.title ||
                current.contentKind !== next.contentKind
              ) {
                updates.upcomingContent = next;
              }
            } else if (task.upcomingContent) {
              updates.upcomingContent = undefined;
            }

            if (detectionResult.status !== task.showStatus) {
              updates.showStatus = detectionResult.status;
            }
          }

          // Apply updates if there are any
          if (Object.keys(updates).length > 0) {
            onUpdateTask(task.id, updates);
          }
        }

        setScannedCount(i + 1);

        // Yield to UI to prevent lag
        await yieldToUI();

        // Rate limiting: wait 250ms between API requests only
        if (needsApiCall && i < tasksToProcess.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      } catch (error) {
        console.error(`Error scanning task ${task.id}:`, error);
      }
    }

    setResults(newResults.length > MAX_RESULTS ? newResults.slice(-MAX_RESULTS) : newResults);
    setScanning(false);
  }, [tasks, enabled, scanning, onUpdateTask]);

  // Auto-scan when enabled (debounced)
  useEffect(() => {
    if (!enabled) return;

    // Wait 3 seconds after board loads to let UI settle first
    const timer = setTimeout(() => {
      scanTasks(false); // Don't force API refresh on auto-scan
    }, 3000);

    return () => clearTimeout(timer);
  }, [enabled]); // Only trigger on enable, not on every tasks change

  // Manual rescan function - uses cache, only hits API if cache > 24 hours old
  const rescan = useCallback(() => {
    scanTasks(true); // Force scan even if not enabled
  }, [scanTasks]);

  return {
    scanning,
    scannedCount,
    totalToScan,
    results,
    rescan,
  };
}
