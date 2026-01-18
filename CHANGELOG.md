# Changelog

All notable changes to Smart Kanban will be documented in this file.

## [0.3.4] - 2026-01-18

### Major Refactor: Agent Architecture

The Smart Content Engine has been refactored from a monolithic switch/case design to a modular **Agent Architecture**. Each content type is now handled by a specialized agent that owns its detection patterns and API integrations.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AGENT ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ContentEngine ──► AgentOrchestrator ──┬──► TVSeriesAgent (TMDb+OMDb)  │
│       │                                ├──► MovieAgent (TMDb+OMDb)      │
│       │                                ├──► AnimeAgent (Jikan)          │
│    Cache                               ├──► BookAgent (OpenLibrary)     │
│   (1 hour)                             └──► GameAgent (RAWG)            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Added

- **BaseAgent Abstract Class** (`src/engine/agents/BaseAgent.ts`)
  - Shared detection logic (keywords, URL patterns, list context)
  - Metadata extraction (year, year range, author)
  - Confidence scoring system
  - Abstract `enrich()` method for subclasses

- **AgentOrchestrator** (`src/engine/agents/AgentOrchestrator.ts`)
  - Manages all content agents
  - Parallel detection across all agents
  - Routes enrichment to appropriate agent by content type
  - Configurable confidence threshold (default: 25%)
  - Combined `process()` method for detect + enrich

- **Entertainment Agents** (`src/engine/agents/entertainment/`)
  - `TVSeriesAgent` - TV shows, miniseries (TMDb + OMDb APIs)
  - `MovieAgent` - Films, cinema (TMDb + OMDb APIs)
  - `AnimeAgent` - Japanese animation (Jikan/MAL API)

- **Leisure Agents** (`src/engine/agents/leisure/`)
  - `BookAgent` - Books, novels (OpenLibrary API)
  - `GameAgent` - Video games (RAWG API)

- **New Exports** (`src/engine/index.ts`)
  - `getOrchestrator()` - Get singleton orchestrator instance
  - `BaseAgent`, `AgentOrchestrator` - For extension
  - All individual agents for direct use
  - Type exports: `DetectionContext`, `AgentDetectionResult`, `OrchestratorConfig`

### Changed

- **ContentEngine** now delegates enrichment to AgentOrchestrator
  - Removed individual `enrichTVSeries()`, `enrichMovie()`, etc. functions
  - Cache layer remains in ContentEngine
  - Single line: `orchestrator.enrich(title, type, year)`

### Benefits

| Before | After |
|--------|-------|
| Switch/case with 5 branches | 5 independent agents |
| Enrichment logic in ContentEngine | Each agent owns its APIs |
| Adding new type = modify switch | Adding new type = create agent |
| Sequential detection | Parallel detection |
| Hard to test individual types | Agents are unit-testable |

### How to Add a New Content Type

1. Create agent: `src/engine/agents/leisure/PodcastAgent.ts`
2. Extend `BaseAgent`, implement `keywords`, `urlPatterns`, `enrich()`
3. Register in `AgentOrchestrator.initializeAgents()`
4. Export from `agents/index.ts`
5. Add type to `ContentType` in `types.ts`

### Updated Documentation

- `docs/ARCHITECTURE.md` - Comprehensive agent architecture docs

---

## [0.3.3] - 2026-01-18

### Problem Solved: Why Imports Failed to Show Smart Insights

**Root Cause:** Content detection relies on context clues that imports often lack:

| Context Clue | Example | What it Signals |
|--------------|---------|-----------------|
| List name | "Marvel - Finished", "To Watch" | Entertainment content |
| Checklist names | "Season 1", "Season 2" | TV Series |
| URLs | IMDb, TMDb links | Confirms entertainment |
| Year patterns | "(2015-2019)" | Multi-year series |

**Why Imports Fail:**
- Cards land in generic lists like "Uncategorized" or "Backlog"
- No checklist structure imported yet
- Missing context = low confidence = no insights

**Solution:** Store content type with task + allow manual override

### Added
- **Manual Content Type Selection**: Users can now manually set content type for any card
  - Click the content type badge to change it
  - Amber "? Set type for insights" prompt appears for uncategorized content
  - Type picker shows suggestions based on detected signals
  - Manual selections are persisted and marked with *

- **Smart Detection for Imports**: Content type is now stored with tasks
  - `contentType`, `contentTypeConfidence`, `contentTypeManual` fields added
  - Detection runs on import and stores results
  - Low confidence items prompt user for categorization

### Changed
- Content type badge is now clickable (opens type picker)
- Hook returns `needsUserInput` and `suggestedTypes` for UI prompts
- Enrichment uses stored type when available (faster, more accurate)

### Architecture Flow
```
┌─────────────────────────────────────────────────────────────┐
│                    CONTENT DETECTION FLOW                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Import/Create Card                                         │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐                                           │
│  │   Detect    │◄── title + description + list + URLs      │
│  │ Content Type│                                           │
│  └──────┬──────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌─────────────┐    Yes    ┌──────────────────┐           │
│  │ Confidence  │──────────►│  Fetch Enrichment │           │
│  │   >= 40%?   │           │  (TMDb, OMDb...)  │           │
│  └──────┬──────┘           └──────────────────┘           │
│         │ No                                                │
│         ▼                                                   │
│  ┌─────────────────────┐                                   │
│  │ Show "Set Type"     │                                   │
│  │ Prompt to User      │                                   │
│  └──────────┬──────────┘                                   │
│             │ User selects                                  │
│             ▼                                               │
│  ┌─────────────────────┐                                   │
│  │ Store contentType   │                                   │
│  │ contentTypeManual   │                                   │
│  └──────────┬──────────┘                                   │
│             │                                               │
│             ▼                                               │
│  ┌──────────────────┐                                      │
│  │ Fetch Enrichment │                                      │
│  │ with stored type │                                      │
│  └──────────────────┘                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### New Files
- `src/components/ContentTypePicker.tsx` - Type selection UI component

### Modified Files
- `src/hooks/useContentEnrichment.ts` - Added stored type support, needsUserInput
- `src/components/TaskDetailModal.tsx` - Clickable badge, type picker integration
- `src/App.tsx` - Added contentType fields to TaskItem interface

## [0.3.2] - 2026-01-18

### Added
- **Collapsible Links section**: Links are now collapsed by default, click to expand
- **Your Progress tracking**: New section showing your watch progress vs series total
  - Visual progress bar (blue = watching, green = completed)
  - Status badge (Watching/Completed)
  - Seasons counter (e.g., "3/5 seasons")
  - Remaining seasons text (e.g., "2 seasons remaining")

### Note on Ratings
- **TMDb**: Community ratings from The Movie Database users
- **IMDb**: Community ratings from Internet Movie Database users
- **Rotten Tomatoes**: Critic scores (shows when available from OMDb API)

Different platforms have different user bases, so ratings may vary.

## [0.3.1] - 2026-01-18

### Fixed
- **Smart Insights not loading**: Fixed issue where enrichment API received entire card description instead of just the title
- **Wrong show/movie returned**: Added year parameter to API calls to distinguish between remakes/reboots (e.g., Twilight Zone 1959 vs 2002)
- **Loading indicator**: Removed confusing "Loading..." text that appeared alongside ratings; now only shows spinner when no data yet

### Changed
- Title cleaning now happens directly in the hook using regex, not relying on detection metadata
- Year is extracted from card title and passed to TMDb/OMDb APIs for better search accuracy

## [0.3.0] - 2026-01-18

### Added
- **Smart Content Engine**: Universal content detection and enrichment system
  - Detects content type: TV Series, Movies, Anime, Books, Games
  - Pattern matching with confidence scoring
  - Lens-based architecture for extensibility

- **Content Enrichment APIs**:
  - TMDb API for movies and TV series (ratings, streaming, seasons, episodes)
  - OMDb API for IMDb and Rotten Tomatoes ratings
  - Jikan API for anime (MyAnimeList data)
  - Open Library API for books
  - RAWG API for video games

- **Smart Insights in Task Modal**:
  - Ratings displayed as clickable badges (TMDb, IMDb, Rotten Tomatoes)
  - Streaming availability (where to watch)
  - Season/episode counts for TV series
  - Genre tags
  - Quick links to external databases
  - Franchise/collection info for movies

- **New Components**:
  - `TaskDetailModal.tsx` - Extracted modal with integrated Smart Insights
  - `useContentEnrichment.ts` - React hook for automatic data fetching
  - `SmartInsights.tsx` - Standalone insights component

### Fixed
- TypeScript errors: Added 'goal' to ViewMode type
- TypeScript errors: Fixed implicit 'any' type on match variables
- TypeScript errors: Fixed TaskItem property names (checked vs completed)
- Added 'ideas' category to ChatInterface empty states

## [0.2.9] - 2026-01-17

### Fixed
- JSX element nesting error in task detail modal
- Import cancel not discarding data
- Checklists not importing from Trello
- Links showing raw URLs instead of meaningful titles

---

For detailed error resolutions, see [docs/ERRORS.md](docs/ERRORS.md)
