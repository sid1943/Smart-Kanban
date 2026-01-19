// Agent Orchestrator - Manages all content agents
// Runs detection in parallel and picks the best match

import { BaseAgent, DetectionContext, AgentDetectionResult } from './BaseAgent';
import { ContentType, EnrichedData, DetectionResult, LensCategory } from '../types';

// Import all agents
import { TVSeriesAgent } from './entertainment/TVSeriesAgent';
import { MovieAgent } from './entertainment/MovieAgent';
import { AnimeAgent } from './entertainment/AnimeAgent';
import { BookAgent } from './leisure/BookAgent';
import { GameAgent } from './leisure/GameAgent';

// Orchestrator configuration
export interface OrchestratorConfig {
  // Minimum confidence to return a result (0-100)
  confidenceThreshold: number;
  // Run agents in parallel (faster) or sequential (lower resource usage)
  parallel: boolean;
  // Enable/disable specific agents
  enabledAgents?: ContentType[];
  // Enable background mode with Web Workers
  backgroundMode?: boolean;
}

// Result from orchestrator detection
export interface OrchestratorDetectionResult extends DetectionResult {
  agent: string;
  allResults: { agent: string; type: ContentType; confidence: number }[];
}

// Default configuration
const DEFAULT_CONFIG: OrchestratorConfig = {
  confidenceThreshold: 25,
  parallel: true,
  backgroundMode: false,
};

export class AgentOrchestrator {
  private agents: BaseAgent[] = [];
  private config: OrchestratorConfig;
  private backgroundModeEnabled = false;
  private workerCoordinator: import('../workers/coordinator/TaskCoordinator').TaskCoordinator | null = null;

  constructor(config?: Partial<OrchestratorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeAgents();

    // Initialize background mode if enabled
    if (this.config.backgroundMode) {
      this.enableBackgroundMode();
    }
  }

  /**
   * Enable background mode with Web Workers
   */
  async enableBackgroundMode(): Promise<void> {
    if (this.backgroundModeEnabled) return;

    try {
      const { initializeTaskCoordinator } = await import('../workers/coordinator/TaskCoordinator');
      this.workerCoordinator = await initializeTaskCoordinator({
        confidenceThreshold: this.config.confidenceThreshold,
      });
      this.backgroundModeEnabled = true;
      console.log('[Orchestrator] Background mode enabled');
    } catch (error) {
      console.error('[Orchestrator] Failed to enable background mode:', error);
      this.backgroundModeEnabled = false;
    }
  }

  /**
   * Disable background mode
   */
  async disableBackgroundMode(): Promise<void> {
    if (!this.backgroundModeEnabled) return;

    if (this.workerCoordinator) {
      await this.workerCoordinator.shutdown();
      this.workerCoordinator = null;
    }
    this.backgroundModeEnabled = false;
    console.log('[Orchestrator] Background mode disabled');
  }

  /**
   * Check if background mode is enabled
   */
  isBackgroundModeEnabled(): boolean {
    return this.backgroundModeEnabled;
  }

  /**
   * Get the worker coordinator (for advanced usage)
   */
  getWorkerCoordinator(): import('../workers/coordinator/TaskCoordinator').TaskCoordinator | null {
    return this.workerCoordinator;
  }

  // Initialize all agents
  private initializeAgents(): void {
    // Entertainment agents
    this.agents.push(new TVSeriesAgent());
    this.agents.push(new MovieAgent());
    this.agents.push(new AnimeAgent());

    // Leisure agents
    this.agents.push(new BookAgent());
    this.agents.push(new GameAgent());

    // Filter by enabled agents if specified
    if (this.config.enabledAgents) {
      this.agents = this.agents.filter(
        agent => this.config.enabledAgents!.includes(agent.type)
      );
    }

    console.log(`[Orchestrator] Initialized ${this.agents.length} agents:`,
      this.agents.map(a => a.name).join(', '));
  }

  // Get all registered agents
  getAgents(): BaseAgent[] {
    return [...this.agents];
  }

  // Get agent by type
  getAgent(type: ContentType): BaseAgent | undefined {
    return this.agents.find(agent => agent.type === type);
  }

  // Enable/disable an agent
  setAgentEnabled(type: ContentType, enabled: boolean): void {
    const agent = this.getAgent(type);
    if (agent) {
      agent.config.enabled = enabled;
    }
  }

  /**
   * Run detection across all agents
   * Returns the best matching agent's result
   */
  async detect(context: DetectionContext): Promise<OrchestratorDetectionResult> {
    console.log(`[Orchestrator] Running detection for: ${context.title}`);

    let results: { agent: BaseAgent; result: AgentDetectionResult }[];

    if (this.config.parallel) {
      // Run all agents in parallel
      results = await Promise.all(
        this.agents
          .filter(agent => agent.config.enabled)
          .map(async agent => ({
            agent,
            result: agent.canHandle(context),
          }))
      );
    } else {
      // Run agents sequentially
      results = [];
      for (const agent of this.agents.filter(a => a.config.enabled)) {
        results.push({
          agent,
          result: agent.canHandle(context),
        });
      }
    }

    // Sort by confidence (descending), then by priority
    results.sort((a, b) => {
      if (b.result.confidence !== a.result.confidence) {
        return b.result.confidence - a.result.confidence;
      }
      return b.agent.config.priority - a.agent.config.priority;
    });

    // Log all results for debugging
    console.log('[Orchestrator] Detection results:',
      results.map(r => `${r.agent.name}: ${r.result.confidence}%`).join(', '));

    // Get best result
    const best = results[0];
    const allResults = results.map(r => ({
      agent: r.agent.name,
      type: r.agent.type,
      confidence: r.result.confidence,
    }));

    // Check if best result meets threshold
    if (!best || best.result.confidence < this.config.confidenceThreshold) {
      return {
        type: 'unknown',
        category: 'unknown',
        confidence: 0,
        signals: [],
        metadata: { title: context.title },
        agent: 'none',
        allResults,
      };
    }

    // Determine category
    const category: LensCategory = best.agent.category === 'entertainment'
      ? 'entertainment'
      : best.agent.category === 'leisure'
        ? 'leisure'
        : 'unknown';

    return {
      type: best.result.type,
      category,
      confidence: best.result.confidence,
      signals: best.result.signals,
      metadata: best.result.metadata,
      agent: best.agent.name,
      allResults,
    };
  }

  /**
   * Enrich content using the appropriate agent
   */
  async enrich(
    title: string,
    type: ContentType,
    year?: string
  ): Promise<EnrichedData> {
    const agent = this.getAgent(type);

    if (!agent) {
      console.error(`[Orchestrator] No agent found for type: ${type}`);
      return null;
    }

    console.log(`[Orchestrator] Delegating enrichment to ${agent.name}`);
    return agent.enrich(title, year);
  }

  /**
   * Combined detect and enrich in one call
   */
  async process(context: DetectionContext): Promise<{
    detection: OrchestratorDetectionResult;
    data: EnrichedData;
  }> {
    // Detect content type
    const detection = await this.detect(context);

    // If unknown or low confidence, skip enrichment
    if (detection.type === 'unknown' || detection.confidence < this.config.confidenceThreshold) {
      return { detection, data: null };
    }

    // Clean title for enrichment
    const cleanTitle = detection.metadata.title || context.title;
    const year = detection.metadata.year || detection.metadata.yearRange?.split(/[-–—]/)[0];

    // Enrich with detected type
    const data = await this.enrich(cleanTitle, detection.type, year);

    return { detection, data };
  }

  /**
   * Submit for background processing (requires background mode)
   * Returns a task ID for tracking
   */
  submitForBackground(
    cardId: string,
    context: DetectionContext,
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): string {
    if (!this.workerCoordinator) {
      throw new Error('Background mode is not enabled');
    }

    return this.workerCoordinator.submitCard(
      cardId,
      context.title,
      context.description,
      context.listContext,
      context.urls,
      context.checklistNames,
      priority
    );
  }

  /**
   * Wait for background task completion
   */
  async waitForBackground(cardId: string, timeoutMs?: number): Promise<{
    success: boolean;
    detection?: DetectionResult;
    data?: EnrichedData;
    error?: string;
  }> {
    if (!this.workerCoordinator) {
      throw new Error('Background mode is not enabled');
    }

    const result = await this.workerCoordinator.waitForCard(cardId, timeoutMs);
    return {
      success: result.success,
      detection: result.detection,
      data: result.data,
      error: result.error,
    };
  }

  /**
   * Subscribe to background task updates
   */
  onBackgroundComplete(
    cardId: string,
    callback: (data: EnrichedData, detection: DetectionResult) => void
  ): () => void {
    if (!this.workerCoordinator) {
      throw new Error('Background mode is not enabled');
    }

    return this.workerCoordinator.onComplete(cardId, (id, data, detection) => {
      callback(data, detection);
    });
  }

  /**
   * Get background mode statistics
   */
  getBackgroundStats(): {
    queue: ReturnType<import('../workers/coordinator/TaskCoordinator').TaskCoordinator['getStats']>['queue'];
    pool: ReturnType<import('../workers/coordinator/TaskCoordinator').TaskCoordinator['getStats']>['pool'];
  } | null {
    if (!this.workerCoordinator) return null;

    const stats = this.workerCoordinator.getStats();
    return {
      queue: stats.queue,
      pool: stats.pool,
    };
  }
}

// Singleton instance for convenience
let defaultOrchestrator: AgentOrchestrator | null = null;

export function getOrchestrator(config?: Partial<OrchestratorConfig>): AgentOrchestrator {
  if (!defaultOrchestrator || config) {
    defaultOrchestrator = new AgentOrchestrator(config);
  }
  return defaultOrchestrator;
}

// Reset orchestrator (useful for testing)
export function resetOrchestrator(): void {
  defaultOrchestrator = null;
}

export default AgentOrchestrator;
