# Smart Kanban Architecture

This document describes the architecture of Smart Kanban, focusing on the Smart Content Engine and how components interact.

---

## Table of Contents
1. [Overview](#overview)
2. [Core Data Structures](#core-data-structures)
3. [Smart Content Engine](#smart-content-engine)
4. [Agent Architecture](#agent-architecture)
5. [Component Architecture](#component-architecture)
6. [Data Flow](#data-flow)
7. [API Integrations](#api-integrations)
8. [File Structure](#file-structure)

---

## Overview

Smart Kanban is a Trello-like task management app with **Smart Insights** - automatic content detection and enrichment that shows ratings, streaming info, and metadata for entertainment content.

### Key Features
- Kanban board with drag-and-drop
- Trello JSON import
- Smart Content Engine (auto-detects TV, Movies, Anime, Books, Games)
- API enrichment (TMDb, OMDb, Jikan, OpenLibrary, RAWG)
- Manual content type override

---

## Core Data Structures

### TaskItem
The primary data structure for cards/tasks:

```typescript
interface TaskItem {
  id: string;
  text: string;                    // Card title
  checked: boolean;                // Completion status
  category?: string;               // List/category name
  description?: string;            // Card description
  dueDate?: string;
  priority?: 'low' | 'medium' | 'high';
  labels?: TaskLabel[];
  checklists?: Checklist[];
  checklistTotal?: number;
  checklistChecked?: number;
  links?: ExtractedLink[];         // URLs extracted from card

  // Smart Content Engine fields
  contentType?: ContentType;       // 'tv_series' | 'movie' | 'anime' | 'book' | 'game' | 'music' | 'unknown'
  contentTypeConfidence?: number;  // 0-100 detection confidence
  contentTypeManual?: boolean;     // true if user manually set type
}
```

### ContentType
Supported content types for Smart Insights:

```typescript
type ContentType =
  | 'tv_series'  // TV Shows, Limited Series, Miniseries
  | 'movie'      // Films, Cinema
  | 'anime'      // Japanese Animation
  | 'book'       // Books, Novels, Audiobooks
  | 'game'       // Video Games
  | 'music'      // Albums, Songs
  | 'unknown';   // Undetected/Not media
```

---

## Smart Content Engine

### Architecture Overview

The Smart Content Engine uses a modular **Agent Architecture** where specialized agents handle detection and enrichment for each content type. The `AgentOrchestrator` coordinates all agents, running detection in parallel and routing enrichment to the appropriate agent.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SMART CONTENT ENGINE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐       │
│  │    DETECTION    │     │  AGENT ORCHESTRATOR │     │    DISPLAY      │       │
│  │                 │     │                     │     │                 │       │
│  │ ContentDetector │────►│ Coordinates agents  │────►│ TaskDetailModal │       │
│  │ (legacy/direct) │     │ Parallel detection  │     │ SmartInsights   │       │
│  └─────────────────┘     │ Routes enrichment   │     └─────────────────┘       │
│                          └──────────┬──────────┘                               │
│                                     │                                           │
│            ┌────────────────────────┼────────────────────────┐                 │
│            │                        │                        │                 │
│            ▼                        ▼                        ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐       │
│  │                         CONTENT AGENTS                               │       │
│  │                                                                      │       │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                   │       │
│  │  │ TVSeries    │ │ Movie       │ │ Anime       │   ENTERTAINMENT   │       │
│  │  │ Agent       │ │ Agent       │ │ Agent       │                   │       │
│  │  │ TMDb + OMDb │ │ TMDb + OMDb │ │ Jikan       │                   │       │
│  │  └─────────────┘ └─────────────┘ └─────────────┘                   │       │
│  │                                                                      │       │
│  │  ┌─────────────┐ ┌─────────────┐                                   │       │
│  │  │ Book        │ │ Game        │                      LEISURE      │       │
│  │  │ Agent       │ │ Agent       │                                   │       │
│  │  │ OpenLibrary │ │ RAWG        │                                   │       │
│  │  └─────────────┘ └─────────────┘                                   │       │
│  │                                                                      │       │
│  └─────────────────────────────────────────────────────────────────────┘       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Detection Phase

**Location:** `src/engine/detection/ContentDetector.ts`

**Input:** Card title, description, list name, URLs, checklist names

**Process:**
1. Combine all text sources
2. Check URL patterns (IMDb, TMDb, MAL, Goodreads, Steam, Spotify)
3. Check list context mapping
4. Check keyword patterns for each content type
5. Extract metadata (year, author, etc.)
6. Calculate confidence score

**Output:** `DetectionResult`
```typescript
interface DetectionResult {
  type: ContentType;
  category: 'entertainment' | 'leisure' | 'unknown';
  confidence: number;  // 0-100
  signals: string[];   // Why this type was detected
  metadata: {
    title?: string;    // Cleaned title
    year?: string;
    yearRange?: string;
    author?: string;
  };
}
```

### Detection Signals & Weights

| Signal Type | Example | Weight |
|-------------|---------|--------|
| URL: MAL | myanimelist.net/anime/123 | 60 |
| URL: Goodreads | goodreads.com/book/show/123 | 60 |
| URL: Steam | store.steampowered.com/app/123 | 60 |
| URL: TMDb TV | themoviedb.org/tv/123 | 50 |
| URL: TMDb Movie | themoviedb.org/movie/123 | 50 |
| URL: IMDb | imdb.com/title/tt123 | 40 (movie) / 35 (tv) |
| Keywords: Anime | "anime", "manga", "crunchyroll" | 35 |
| Keywords: Book | "book", "novel", "author" | 35 |
| Keywords: Game | "game", "steam", "playstation" | 35 |
| Keywords: TV | "season", "episode", "series" | 30 |
| Keywords: Movie | "movie", "film", "cinema" | 30 |
| List Context | "To Watch", "TV Series" | 25 |
| Year Range | "(2015-2019)" | 20 (tv) / 15 (anime) |

**Confidence Threshold:** 40% (below this, prompt user for input)

---

## Agent Architecture

### Overview

The engine uses a plugin-like **Agent Architecture** where each content type is handled by a specialized agent. This provides:
- **Modularity:** Each agent is self-contained with its own detection rules and API integrations
- **Extensibility:** New content types can be added by creating new agents
- **Parallel Processing:** All agents run detection simultaneously for faster results
- **Encapsulation:** Each agent owns its patterns, keywords, and enrichment logic

### BaseAgent Abstract Class

All agents extend `BaseAgent` which provides common functionality:

```typescript
abstract class BaseAgent {
  // Identity
  abstract readonly type: ContentType;
  abstract readonly name: string;
  abstract readonly category: 'entertainment' | 'leisure';
  abstract readonly apis: string[];

  // Detection patterns (implemented by subclasses)
  protected abstract keywords: RegExp[];
  protected abstract contextKeywords: RegExp[];
  protected abstract urlPatterns: { pattern: RegExp; weight: number }[];
  protected abstract getListContextMappings(): [string, number][];

  // Core methods
  canHandle(context: DetectionContext): AgentDetectionResult;  // Detection
  abstract enrich(title: string, year?: string): Promise<EnrichedData>; // Enrichment
}
```

### Agent Registry

| Agent | Type | Category | APIs | Primary Signals |
|-------|------|----------|------|-----------------|
| TVSeriesAgent | `tv_series` | Entertainment | TMDb, OMDb | Season/episode patterns, year ranges |
| MovieAgent | `movie` | Entertainment | TMDb, OMDb | Film keywords, runtime patterns |
| AnimeAgent | `anime` | Entertainment | Jikan (MAL) | Japanese chars, anime keywords |
| BookAgent | `book` | Leisure | OpenLibrary | "by Author", ISBN, page counts |
| GameAgent | `game` | Leisure | RAWG | Platform names, game genres |

### AgentOrchestrator

The orchestrator manages all agents and coordinates detection/enrichment:

```typescript
class AgentOrchestrator {
  private agents: BaseAgent[] = [];

  // Detection: Run all agents in parallel, return best match
  async detect(context: DetectionContext): Promise<OrchestratorDetectionResult> {
    const results = await Promise.all(
      agents.map(agent => ({
        agent,
        result: agent.canHandle(context)
      }))
    );
    // Sort by confidence + priority, return best match
    return selectBestResult(results);
  }

  // Enrichment: Delegate to appropriate agent
  async enrich(title: string, type: ContentType, year?: string): Promise<EnrichedData> {
    const agent = this.getAgent(type);
    return agent.enrich(title, year);
  }

  // Combined detect + enrich
  async process(context: DetectionContext): Promise<{ detection, data }>;
}
```

### Detection Context

What each agent receives for detection:

```typescript
interface DetectionContext {
  title: string;           // Card title
  description?: string;    // Card description
  listContext?: string;    // List/category name
  urls?: string[];         // Extracted URLs
  checklistNames?: string[]; // Checklist titles (e.g., "Season 1")
}
```

### Agent Detection Result

What each agent returns from detection:

```typescript
interface AgentDetectionResult {
  type: ContentType;
  confidence: number;     // 0-100
  signals: string[];      // Why this was detected
  metadata: {
    title: string;
    year?: string;
    yearRange?: string;
    author?: string;
  };
}
```

### Adding a New Agent

To add support for a new content type:

1. Create a new agent file in the appropriate category folder:
   ```
   src/engine/agents/leisure/PodcastAgent.ts
   ```

2. Extend `BaseAgent` and implement required methods:
   ```typescript
   export class PodcastAgent extends BaseAgent {
     readonly type = 'podcast' as const;
     readonly name = 'Podcast Agent';
     readonly category = 'leisure' as const;
     readonly apis = ['Spotify', 'Apple Podcasts'];

     protected keywords = [/\bpodcast\b/i, /\bepisodes?\b/i];
     protected contextKeywords = [...];
     protected urlPatterns = [...];

     protected getListContextMappings() { return [...]; }

     async enrich(title: string): Promise<EnrichedData> {
       // Call Spotify/Apple Podcasts API
     }
   }
   ```

3. Register in `AgentOrchestrator.ts`:
   ```typescript
   import { PodcastAgent } from './leisure/PodcastAgent';

   private initializeAgents(): void {
     // ... existing agents
     this.agents.push(new PodcastAgent());
   }
   ```

4. Export from `agents/index.ts`:
   ```typescript
   export { PodcastAgent } from './leisure/PodcastAgent';
   ```

5. Add type to `types.ts`:
   ```typescript
   type ContentType = ... | 'podcast' | ...;
   ```

---

### Enrichment Phase

**Location:** `src/engine/ContentEngine.ts` → `AgentOrchestrator` → Individual Agents

**Process:**
1. ContentEngine checks cache (1-hour TTL)
2. If not cached, delegates to AgentOrchestrator
3. Orchestrator routes to appropriate agent by content type
4. Agent calls its APIs and merges data
5. ContentEngine caches result
6. Return enriched data

**API Flow by Content Type:**

| Content Type | Primary API | Secondary API | Data Retrieved |
|--------------|-------------|---------------|----------------|
| TV Series | TMDb | OMDb | Ratings, seasons, episodes, streaming, genres |
| Movie | TMDb | OMDb | Ratings, runtime, streaming, franchise |
| Anime | Jikan (MAL) | - | Ratings, episodes, status, studios |
| Book | OpenLibrary | - | Author, pages, subjects, related books |
| Game | RAWG | - | Ratings, platforms, playtime, developer |

### Caching Strategy

```typescript
// In-memory cache with 1-hour TTL
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface CacheEntry {
  data: EnrichedData;
  timestamp: number;
}

// Cache key format: "{type}:{title_lowercase}"
// Example: "tv_series:jessica jones"
```

---

## Component Architecture

### React Component Hierarchy

```
App.tsx
├── TaskDetailModal
│   ├── useContentEnrichment (hook)
│   ├── ContentTypePicker
│   └── [Smart Insights UI]
│       ├── Ratings Bar
│       ├── Streaming Info
│       ├── Entertainment Info
│       ├── Your Progress
│       ├── Genres
│       └── Quick Links
└── SmartInsights (standalone component)
```

### useContentEnrichment Hook

**Location:** `src/hooks/useContentEnrichment.ts`

**Purpose:** Manages content detection and enrichment lifecycle

**Props:**
```typescript
interface UseContentEnrichmentProps {
  title: string;
  description?: string;
  listContext?: string;
  urls?: string[];
  checklistNames?: string[];
  storedContentType?: ContentType;      // Use stored type if available
  storedContentTypeManual?: boolean;    // Skip detection if manual
}
```

**Returns:**
```typescript
interface UseContentEnrichmentResult {
  detection: DetectionResult | null;
  data: EnrichedData;
  loading: boolean;
  error: string | null;
  needsUserInput: boolean;              // True if confidence < 40%
  suggestedTypes: { type: ContentType; confidence: number }[];
}
```

**Logic Flow:**
```
1. If storedContentType + storedContentTypeManual → use directly, skip detection
2. Else → run detection
3. If confidence >= 40% → fetch enrichment
4. If confidence < 40% → set needsUserInput=true, show suggestions
5. If user selects type → store it, fetch enrichment
```

### ContentTypePicker Component

**Location:** `src/components/ContentTypePicker.tsx`

**Purpose:** UI for manual content type selection

**Features:**
- Shows suggestions based on detection signals
- Grid of all content types
- "Skip - Not media content" option
- Compact mode for inline display

---

## Data Flow

### Task Creation Patterns

The application supports multiple ways to add tasks. Each method has different detection requirements:

| Creation Method | Detection Timing | Enrichment Timing | Why |
|-----------------|------------------|-------------------|-----|
| **Trello Import** | During import (batch) | During import (batch) | Bulk operation - pre-cache for instant card opens |
| **Manual Add** | On card open | On card open | Single task - lazy load is acceptable |
| **Chat/AI Generated** | None | None | Learning tasks, not media content |
| **Future: API Sync** | During sync | During sync | Bulk operation - same as import |

### Standard: Detect-Then-Enrich Pattern

**REQUIRED for all bulk/import operations.** This is the standard pattern for adding boards or importing data.

| Step | Action | Required | Reason |
|------|--------|----------|--------|
| 1 | Parse source data | Yes | Convert external format to TaskItem[] |
| 2 | Create tasks (without contentType) | Yes | Initial task structure |
| 3 | **DETECT content types** | **CRITICAL** | Sets `contentType` field on each task |
| 4 | Filter tasks by contentType | Yes | Only enrich recognized media types |
| 5 | Enrich filtered tasks | Yes | Fetch API data, cache on task |
| 6 | Store tasks | Yes | Persist to localStorage |

**Why Phase 3 (Detection) is Critical:**
- Tasks are created in Phase 2 without `contentType` field
- Phase 4 filters by `contentType` to find enrichable tasks
- Without Phase 3, `contentType` is undefined → all tasks fail filter → zero enrichment
- This was the root cause of "import not working for movies" bug

### Import Flow

**Key Technique: Detect-Then-Enrich Pattern**

When importing external data, content type detection MUST run BEFORE enrichment filtering. This is critical because:
1. Tasks are created without `contentType` initially
2. Enrichment filters check `contentType` to determine which tasks to enrich
3. Without detection first, all tasks fail the filter and get no enrichment

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Trello JSON │────►│ Parse Cards  │────►│ For each card:  │
└─────────────┘     └──────────────┘     │ - Extract links │
                                         │ - Map checklists│
                                         │ - Set category  │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                    ┌──────────────────────────┐
                                    │ PHASE 1: DETECT TYPES    │
                                    │ For each task:           │
                                    │ - AgentOrchestrator      │
                                    │   .detect(title, desc,   │
                                    │    list, urls, checklists)│
                                    │ - Set task.contentType   │
                                    │ - Set task.confidence    │
                                    └────────────┬─────────────┘
                                                 │
                                                 ▼
                                    ┌──────────────────────────┐
                                    │ PHASE 2: FILTER & ENRICH │
                                    │ Filter tasks where:      │
                                    │ - contentType is valid   │
                                    │ - confidence >= 25       │
                                    │                          │
                                    │ For each filtered task:  │
                                    │ - Fetch API data         │
                                    │ - Cache enrichment       │
                                    │ - Detect new content     │
                                    └────────────┬─────────────┘
                                                 │
                                                 ▼
                                         ┌─────────────────┐
                                         │ Store in Goals  │
                                         │ (localStorage)  │
                                         └─────────────────┘
```

**Import Code Pattern:**
```typescript
// PHASE 1: Detect content types BEFORE filtering
const orchestrator = getOrchestrator();
for (const task of tasks) {
  const detection = await orchestrator.detect({
    title: task.text,
    description: task.description,
    listContext: task.category,
    urls: task.links?.map(l => l.url),
    checklistNames: task.checklists?.map(cl => cl.name),
  });

  if (detection.type !== 'unknown' && detection.confidence >= 25) {
    task.contentType = detection.type;
    task.contentTypeConfidence = detection.confidence;
  }
}

// PHASE 2: Now filter works because contentType is set
const tasksToEnrich = tasks.filter(t =>
  t.contentType && scannableTypes.includes(t.contentType)
);
```

**Why This Matters:**
- Without Phase 1, all tasks have `contentType === undefined`
- The enrichment filter checks `if (!task.contentType)` → returns false
- Result: Zero tasks get enriched, no Smart Insights on import
- With Phase 1, content types are detected first, filter finds valid tasks

### Implementation Checklist for New Import Sources

When adding a new import source (e.g., Notion, CSV, API), use this checklist:

| # | Checklist Item | Code Reference |
|---|----------------|----------------|
| ☐ | Parse source into `TaskItem[]` array | Custom parser |
| ☐ | Extract URLs from description/attachments | `task.links = [...]` |
| ☐ | Map checklists if available | `task.checklists = [...]` |
| ☐ | Set category from source list/board | `task.category = ...` |
| ☐ | **Run detection loop BEFORE enrichment filter** | See code pattern below |
| ☐ | Filter tasks with valid `contentType` | `tasks.filter(t => t.contentType)` |
| ☐ | Enrich filtered tasks with API data | `orchestrator.enrich()` |
| ☐ | Cache enrichment on task | `task.cachedEnrichment = {...}` |
| ☐ | Run new content detection | `newContentOrchestrator.detect()` |
| ☐ | Store tasks to state/localStorage | `setGoals(...)` |

**Detection Loop (Copy This):**
```typescript
// CRITICAL: Detect content types BEFORE filtering
const orchestrator = getOrchestrator();
for (const task of tasks) {
  const detection = await orchestrator.detect({
    title: task.text,
    description: task.description,
    listContext: task.category,
    urls: task.links?.map(l => l.url),
    checklistNames: task.checklists?.map(cl => cl.name),
  });
  if (detection.type !== 'unknown' && detection.confidence >= 25) {
    task.contentType = detection.type;
    task.contentTypeConfidence = detection.confidence;
  }
}
```

### Card Open Flow

```
┌────────────────┐     ┌─────────────────────┐
│ User clicks    │────►│ TaskDetailModal     │
│ card           │     │ opens               │
└────────────────┘     └──────────┬──────────┘
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │ useContentEnrichment│
                       │ hook runs           │
                       └──────────┬──────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    │             │             │
                    ▼             ▼             ▼
           ┌────────────┐ ┌────────────┐ ┌────────────┐
           │ Has stored │ │ Detection  │ │ Detection  │
           │ manual type│ │ confident  │ │ uncertain  │
           └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
                 │              │              │
                 │              │              ▼
                 │              │     ┌────────────────┐
                 │              │     │ Show "Set Type"│
                 │              │     │ prompt         │
                 │              │     └────────┬───────┘
                 │              │              │ User selects
                 │              │              ▼
                 │              │     ┌────────────────┐
                 │              │     │ Store type     │
                 │              │     │ contentType    │
                 │              │     │ contentTypeManual
                 │              │     └────────┬───────┘
                 │              │              │
                 ▼              ▼              ▼
           ┌─────────────────────────────────────────┐
           │           Fetch Enrichment              │
           │  (TMDb → OMDb → merge ratings)         │
           └────────────────────┬────────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Display Smart   │
                       │ Insights UI     │
                       └─────────────────┘
```

---

## API Integrations

### TMDb (The Movie Database)
- **Base URL:** `https://api.themoviedb.org/3`
- **Auth:** API key (query param)
- **Used for:** Movies, TV Series
- **Endpoints:**
  - `/search/movie` - Search movies
  - `/search/tv` - Search TV shows
  - `/movie/{id}` - Movie details
  - `/tv/{id}` - TV details
  - `/{type}/{id}/watch/providers` - Streaming availability

### OMDb (Open Movie Database)
- **Base URL:** `https://www.omdbapi.com`
- **Auth:** API key (query param)
- **Used for:** IMDb ratings, Rotten Tomatoes, Metacritic
- **Rate limit:** 1000 requests/day (free tier)

### Jikan (MyAnimeList Unofficial API)
- **Base URL:** `https://api.jikan.moe/v4`
- **Auth:** None required
- **Used for:** Anime
- **Endpoints:**
  - `/anime` - Search anime
  - `/anime/{id}` - Anime details

### Open Library
- **Base URL:** `https://openlibrary.org`
- **Auth:** None required
- **Used for:** Books
- **Endpoints:**
  - `/search.json` - Search books
  - `/authors/{id}.json` - Author details

### RAWG
- **Base URL:** `https://api.rawg.io/api`
- **Auth:** API key (query param)
- **Used for:** Video Games
- **Endpoints:**
  - `/games` - Search games
  - `/games/{id}` - Game details

---

## File Structure

```
src/
├── engine/                          # Smart Content Engine
│   ├── index.ts                     # Public exports
│   ├── types.ts                     # Type definitions
│   ├── ContentEngine.ts             # Main engine (cache + orchestrator)
│   │
│   ├── agents/                      # Agent Architecture
│   │   ├── index.ts                 # Agent exports
│   │   ├── BaseAgent.ts             # Abstract base class
│   │   ├── AgentOrchestrator.ts     # Coordinates all agents
│   │   │
│   │   ├── entertainment/           # Entertainment category agents
│   │   │   ├── TVSeriesAgent.ts     # TV shows (TMDb + OMDb)
│   │   │   ├── MovieAgent.ts        # Movies (TMDb + OMDb)
│   │   │   └── AnimeAgent.ts        # Anime (Jikan/MAL)
│   │   │
│   │   └── leisure/                 # Leisure category agents
│   │       ├── BookAgent.ts         # Books (OpenLibrary)
│   │       └── GameAgent.ts         # Games (RAWG)
│   │
│   ├── detection/
│   │   └── ContentDetector.ts       # Legacy pattern matching
│   │
│   └── enrichment/                  # API clients (used by agents)
│       ├── tmdb.ts                  # TMDb API client
│       ├── omdb.ts                  # OMDb API client
│       ├── jikan.ts                 # Jikan API client (anime)
│       ├── openLibrary.ts           # Open Library API client
│       └── rawg.ts                  # RAWG API client (games)
│
├── hooks/
│   └── useContentEnrichment.ts      # React hook for enrichment
│
├── components/
│   ├── TaskDetailModal.tsx          # Card detail modal
│   ├── ContentTypePicker.tsx        # Manual type selection
│   └── SmartInsights.tsx            # Standalone insights component
│
├── App.tsx                          # Main app + TaskItem interface
│
└── docs/
    ├── ARCHITECTURE.md              # This file
    ├── ERRORS.md                    # Error log and resolutions
    └── CHANGELOG.md                 # Version history
```

---

## Environment Variables

```env
VITE_TMDB_API_KEY=your_tmdb_key
VITE_OMDB_API_KEY=your_omdb_key
VITE_RAWG_API_KEY=your_rawg_key
```

**Note:** API keys have hardcoded fallbacks in the code for development.

---

## Future Considerations

### Agent Architecture Extensions
- [ ] PodcastAgent - Spotify, Apple Podcasts APIs
- [ ] RecipeAgent - Spoonacular API
- [ ] MusicAgent - Spotify, Last.fm APIs
- [ ] Custom agents for user-defined content types
- [ ] Agent priority configuration per user

### Planned Improvements
- [x] Run detection during import, not just on modal open (v0.3.6)
- [x] Use AgentOrchestrator for detection (not just enrichment) (v0.3.6)
- [ ] Batch API calls for multiple cards
- [ ] Offline mode with cached data
- [ ] User preferences for default content type per list

### Performance Optimizations
- [ ] Debounce detection on rapid modal opens
- [ ] Prefetch enrichment for visible cards
- [ ] Service worker for API caching
- [ ] Agent detection result caching

---

*Last updated: 2026-01-19 | Version: 0.3.6 (Detect-Then-Enrich Pattern)*
