// Agent Worker - Web Worker entry point
// Runs detection and enrichment in a background thread

import { ContentType, EnrichedData, DetectionResult } from '../../types';
import { DetectionContext } from '../../agents/BaseAgent';

// Import all agents (they run inside the worker)
import { TVSeriesAgent } from '../../agents/entertainment/TVSeriesAgent';
import { MovieAgent } from '../../agents/entertainment/MovieAgent';
import { AnimeAgent } from '../../agents/entertainment/AnimeAgent';
import { BookAgent } from '../../agents/leisure/BookAgent';
import { GameAgent } from '../../agents/leisure/GameAgent';
import { BaseAgent } from '../../agents/BaseAgent';

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

interface DetectPayload {
  context: DetectionContext;
}

interface EnrichPayload {
  title: string;
  contentType: ContentType;
  year?: string;
}

interface DetectAndEnrichPayload {
  context: DetectionContext;
  confidenceThreshold?: number;
}

// Worker state
let workerId: string = `worker_${Date.now()}`;
let agents: BaseAgent[] = [];
let initialized = false;

// Initialize all agents
function initializeAgents(): void {
  agents = [
    new TVSeriesAgent(),
    new MovieAgent(),
    new AnimeAgent(),
    new BookAgent(),
    new GameAgent(),
  ];
  initialized = true;
  console.log(`[Worker ${workerId}] Initialized ${agents.length} agents`);
}

// Get agent by content type
function getAgent(type: ContentType): BaseAgent | undefined {
  return agents.find((agent) => agent.type === type);
}

// Run detection across all agents
function detect(context: DetectionContext): {
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
} {
  const results = agents
    .filter((agent) => agent.config.enabled)
    .map((agent) => ({
      agent,
      result: agent.canHandle(context),
    }));

  // Sort by confidence (descending), then by priority
  results.sort((a, b) => {
    if (b.result.confidence !== a.result.confidence) {
      return b.result.confidence - a.result.confidence;
    }
    return b.agent.config.priority - a.agent.config.priority;
  });

  const best = results[0];
  const allResults = results.map((r) => ({
    type: r.agent.type,
    confidence: r.result.confidence,
    agent: r.agent.name,
  }));

  return {
    winner: {
      type: best?.result.type || 'unknown',
      confidence: best?.result.confidence || 0,
      signals: best?.result.signals || [],
      metadata: best?.result.metadata || {},
      agent: best?.agent.name || 'none',
    },
    allResults,
  };
}

// Run enrichment with the appropriate agent
async function enrich(
  title: string,
  contentType: ContentType,
  year?: string
): Promise<EnrichedData> {
  const agent = getAgent(contentType);
  if (!agent) {
    throw new Error(`No agent found for content type: ${contentType}`);
  }
  return agent.enrich(title, year);
}

// Combined detect and enrich
async function detectAndEnrich(
  context: DetectionContext,
  confidenceThreshold: number = 25
): Promise<{
  detection: DetectionResult;
  data: EnrichedData;
}> {
  const { winner, allResults } = detect(context);

  const detection: DetectionResult = {
    type: winner.type,
    category:
      winner.type === 'tv_series' || winner.type === 'movie' || winner.type === 'anime'
        ? 'entertainment'
        : winner.type === 'book' || winner.type === 'game'
        ? 'leisure'
        : 'unknown',
    confidence: winner.confidence,
    signals: winner.signals,
    metadata: winner.metadata,
  };

  // Skip enrichment if confidence too low
  if (winner.type === 'unknown' || winner.confidence < confidenceThreshold) {
    return { detection, data: null };
  }

  // Clean title for enrichment
  const cleanTitle = winner.metadata.title || context.title;
  const year = winner.metadata.year || winner.metadata.yearRange?.split(/[-–—]/)[0];

  // Enrich with detected type
  const data = await enrich(cleanTitle, winner.type, year);

  return { detection, data };
}

// Handle incoming messages
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, type, payload } = event.data;
  const startTime = Date.now();

  try {
    let result: unknown;

    switch (type) {
      case 'INIT':
        workerId = (payload as { workerId?: string })?.workerId || workerId;
        initializeAgents();
        result = { workerId, agentCount: agents.length };
        break;

      case 'DETECT': {
        if (!initialized) initializeAgents();
        const detectPayload = payload as DetectPayload;
        result = detect(detectPayload.context);
        break;
      }

      case 'ENRICH': {
        if (!initialized) initializeAgents();
        const enrichPayload = payload as EnrichPayload;
        result = await enrich(
          enrichPayload.title,
          enrichPayload.contentType,
          enrichPayload.year
        );
        break;
      }

      case 'DETECT_AND_ENRICH': {
        if (!initialized) initializeAgents();
        const daePayload = payload as DetectAndEnrichPayload;
        result = await detectAndEnrich(
          daePayload.context,
          daePayload.confidenceThreshold
        );
        break;
      }

      case 'PING':
        result = { pong: true, workerId, initialized };
        break;

      case 'STATUS':
        result = {
          workerId,
          initialized,
          agentCount: agents.length,
          agents: agents.map((a) => ({
            name: a.name,
            type: a.type,
            enabled: a.config.enabled,
          })),
        };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    const response: WorkerResponse = {
      id,
      type,
      success: true,
      payload: result,
      processingTime: Date.now() - startTime,
    };

    self.postMessage(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Worker ${workerId}] Error handling ${type}:`, error);

    const response: WorkerResponse = {
      id,
      type,
      success: false,
      error: errorMessage,
      processingTime: Date.now() - startTime,
    };

    self.postMessage(response);
  }
};

// Notify main thread that worker is ready
self.postMessage({
  id: 'init',
  type: 'STATUS',
  success: true,
  payload: { status: 'ready', workerId },
});
