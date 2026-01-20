# Changelog

All notable changes to Smart Kanban will be documented in this file.

## [0.3.8] - 2026-01-19

### Added

- **Live Tiles Workspace Dashboard**: Complete visual redesign of workspace dashboard
  - Flat design aesthetic with bold typography
  - Three tile sizes: Small (1x1), Medium (2x2), Wide (4x2)
  - Right-click context menu to change tile size
  - Tile sizes persist to localStorage

- **Flip Animation System**: Dynamic tile content rotation
  - Auto-flip every 7 seconds (staggered between tiles)
  - Front face shows stats overview (boards, tasks, completion %)
  - Back face shows board previews or completion percentage
  - Flip pauses on hover

- **New Components**:
  - `WorkspaceTile.tsx` - Live tile with flip animation
  - `TileGrid.tsx` - CSS Grid layout manager for tiles
  - `src/styles/tiles.css` - Tile animations and responsive grid styles

- **Responsive Grid Layout**: 4-column grid that adapts to screen size
  - Wide tiles span full width, medium tiles span 2 columns
  - Automatic reflow when tile sizes change
  - Mobile-friendly layout adjustments

## [0.3.7] - 2026-01-19

### Added

- **Dynamic Workspace Blocks**: Transformed dashboard into a grid of interactive workspace blocks
  - 2-3 column responsive grid layout for workspaces
  - Each block shows: icon, name, board count, task count, completion percentage
  - Click to expand/collapse workspace and reveal boards within
  - Smooth animations for expand/collapse transitions

- **Enhanced Workspace Interface**: Extended workspace metadata
  - Icon (emoji) for visual identification
  - Description text for workspace purpose
  - Display order for sorting
  - Auto-categories for content type auto-assignment
  - Goal types for goal-based auto-assignment

- **Workspace Selection Modal**: Hybrid workflow for board assignment
  - Auto-detects suggested workspace based on content type and goal type
  - Modal shows all workspaces with suggested option highlighted
  - Works for both new boards and Trello imports
  - Skip option uses auto-detected workspace

- **Board Mini-Cards**: Compact board previews within expanded workspaces
  - Progress bar with completion percentage
  - Task preview (first 2 tasks with checkboxes)
  - Color-coded header matching workspace color
  - Click to open board

- **Activity Tracking**: Track recent board activity
  - `lastActivityAt` timestamp updated on task changes
  - Used for sorting boards by recency
  - Enables "recent activity" summary in workspace blocks

- **New Components**:
  - `WorkspaceBlock.tsx` - Collapsible workspace block with stats
  - `BoardMiniCard.tsx` - Compact board card for workspace grid
  - `WorkspaceSelectModal.tsx` - Workspace picker for new boards

- **Default Workspaces Enhanced**: Predefined workspaces with smart auto-assignment
  - Leisure (movies, TV, anime, games, books, music)
  - Travel (travel-type goals)
  - Learning (learning-type goals)
  - Projects (project, job goals)
  - Personal (cooking, fitness, event, moving goals)

### Changed

- Home view now uses WorkspaceBlock components instead of flat board list
- New board creation triggers workspace selection modal
- Trello import triggers workspace selection after confirmation
- StoredGoal interface extended with `workspaceId`, `workspaceAutoDetected`, `lastActivityAt`

### Changed (Update)

- Removed pre-loaded default workspaces - users now start with an empty workspace list
- Added "Create New Workspace" option directly in the workspace selection modal
- When creating a workspace with a pending board, the board is automatically assigned
- Added empty state UI when no workspaces exist with prompt to create one
- Added "Unassigned Boards" section for boards not assigned to any workspace

### Migration

- Existing boards without `workspaceId` are automatically migrated on load
- Migration uses auto-detection based on content type and goal type
- `workspaceAutoDetected` flag set to true for migrated boards
- Boards without a workspace are shown in "Unassigned Boards" section

## [0.3.6] - 2026-01-19

### Added

- **Drag & Drop Task Cards**: Full drag and drop support for task cards
  - Move cards between columns (e.g., "To Watch" to "Watching")
  - Reorder cards within the same column
  - Visual feedback with highlight ring when dragging
  - Column highlights when card is dragged over it
  - Uses dnd-kit library for smooth animations

- **Drag & Drop Column Reordering**: Drag columns/lists to reorder them
  - Drag column header to move entire column
  - Visual preview shows column being dragged with first 3 cards
  - Column order persists to localStorage (survives page reload)
  - Scroll locked during column drag to prevent unwanted board scrolling

- **Cross-Tab Real-Time Sync**: Changes sync between browser tabs instantly
  - Uses localStorage `storage` event listener
  - Changes in one tab appear immediately in other tabs
  - No manual refresh needed

- **24-Hour API Cache**: API responses cached to preserve free tier limits
  - Enrichment data cached for 24 hours per task
  - Refresh button uses cache, only hits API if cache > 24 hours old
  - Reduces unnecessary API calls significantly

- **Generalized New Content Detection**: Extended "new content" detection to all content types
  - **TV Series**: Detects new seasons via TMDb `number_of_seasons` and `next_episode_to_air`
  - **Movies**: Detects sequels in franchises via TMDb `belongs_to_collection`
  - **Anime**: Detects sequels via Jikan relations API and season tracking
  - **Books**: Detects new books in series or by same author via Open Library
  - **Games**: Detects sequels and DLC via RAWG game-series endpoint
  - Content-specific badge labels: "NEW SEASON", "SEQUEL", "NEW BOOK", "DLC", etc.
  - "UPCOMING" badge for future releases (based on release date)
  - Generic `UpcomingContent` interface for all content types

- **New Content Detection Architecture**
  - Strategy pattern with type-specific detection strategies
  - `NewContentOrchestrator` for routing to appropriate strategy
  - `TVSeriesStrategy`, `MovieStrategy`, `AnimeStrategy`, `BookStrategy`, `GameStrategy`
  - Extensible design for adding new content types

- **Universal Import Enrichment**
  - Import process now enriches all content types (movies, books, games, etc.)
  - Previously only TV series with season checklists were enriched
  - Uses `AgentOrchestrator.enrich()` for type-appropriate API calls
  - Uses `NewContentOrchestrator.detect()` for new content detection

- **Enrichment Data Caching**
  - Enrichment data is now cached on the task and persisted to localStorage
  - Opening a card no longer re-fetches data - uses cached data instantly
  - Background scanner pre-fetches and caches data for all cards on board load
  - Cache is cleared when content type is manually changed (triggers refetch)
  - Stored in `task.cachedEnrichment` with `data` and `fetchedAt` timestamp

- **Background Scanner Improvements**
  - Scanner now caches enrichment data for all content types (not just TV)
  - Scans movies, books, games, anime - caches data so card opens are instant
  - Uses cached data when available (skips API call, no rate limiting delay)
  - Only fetches from API for tasks without cached data

### Fixed

- **Removed Pre-Load Enrichment Screen**: Removed the "Loading Content Data" screen that appeared on every refresh
  - The pre-fetch was redundant since the background scanner already caches enrichment data
  - Had closure issues causing it to run on every refresh regardless of cache state
  - Board now loads instantly without blocking on enrichment pre-fetch

- **Card Moving to Bottom on Click**: Fixed cards with "NEW" badge moving to the bottom of the board when clicked
  - Root cause: `TaskDetailModal` had a `useEffect` that overrode `hasNewContent` based on local season detection
  - Local detection was incomplete (only checked seasons, ignored movies/books/games with sequels)
  - The background scanner (`useNewContentScanner`) is now the authoritative source for `hasNewContent`
  - Clicking cards no longer changes their position or removes their amber styling

- **Stable Card Sorting**: Cards no longer shuffle randomly on re-renders
  - Added `useMemo` to cache grouped/sorted tasks
  - Added original index as tiebreaker for stable sort
  - Prevents cards from changing position unexpectedly

- **Click-and-Drag Horizontal Scroll**: Boards now support horizontal scrolling by click-and-drag
  - Hold mouse button and drag left/right to scroll board columns
  - Prevents accidental drags when clicking cards

- **Stable Column Order**: Columns no longer shift position when cards move between them
  - Column order tracked separately from task grouping
  - Persists across renders and page reloads

- **Card Drag Scroll Preservation**: Board scroll position preserved when dragging cards
  - Scroll position saved on drag start, restored on drag end
  - Prevents board from jumping when dropping cards

- **Data Persistence Race Condition**: Fixed a bug where refreshing the app could lose all data
  - Added `hasLoaded` flag to prevent save effect from running before load completes
  - Ensures localStorage is not overwritten with empty state during initial mount
  - Data now reliably persists across page refreshes

- **Import Missing Content Type Detection**: Fixed import not enriching non-TV content
  - Root cause: Tasks were created without `contentType` field during import
  - The enrichment filter checked for `contentType` which was always undefined
  - Added content type detection phase during import that runs BEFORE enrichment
  - Now all content types (movies, books, games, anime) are detected and enriched on import

## [0.3.5] - 2026-01-18

### Added

- **Collapsible Checklists**: Each checklist can now be collapsed/expanded
  - Click header to toggle visibility
  - Arrow icon indicates state
  - Mini progress bar visible when collapsed
  - "Expand All" / "Collapse All" button

- **Searchable Checklists**: Filter checklist items in real-time
  - Search input with magnifying glass icon
  - Yellow highlight on matching text
  - Shows filtered count (e.g., "3 of 10 items")
  - Hides checklists with no matches
  - Clear button to reset search

- **Auto-Complete Card on Full Checklist Completion**
  - Cards are automatically marked as "done" when all checklist items are checked
  - Works during Trello import (pre-completed checklists)
  - Works when checking the final item interactively
  - Helps track when new content is added (e.g., new season released)

- **New Season Detection & Auto-Add**
  - Automatically detects when new seasons are available via TMDb API
  - Shows amber alert banner "New Season Available!" in Your Progress section
  - Compares API season count with checklist items (e.g., 4 seasons on TMDb vs 3 in checklist)
  - "Add to List" button adds missing seasons with IMDb links
  - Card automatically becomes "incomplete" when new seasons are added

- **Dynamic Card Highlighting for New Content**
  - Cards with new content get amber/gold background and border
  - Animated "NEW" badge appears on card title
  - Cards with new content automatically sort to top of their column
  - Visual cue makes it easy to spot shows with new seasons

- **Background Content Scanner**
  - Automatically scans all TV series cards when board loads
  - Compares checklist seasons with TMDb API data
  - Sets `hasNewContent` flag on cards with new seasons
  - Shows scanning progress indicator in header ("Scanning 2/4")
  - Rate-limited to 4 requests/second to respect API limits

- **Upcoming Season Detection**
  - Detects announced but not-yet-released seasons via TMDb `next_episode_to_air`
  - Cards show "UPCOMING" badge instead of "NEW" for future content
  - Displays upcoming air date (e.g., "S10 • Feb 15, 2026")
  - Works even before episodes are added to TMDb database

- **Show Status Indicators**
  - "Returning" badge (blue) for ongoing shows that may get new seasons
  - "Ended" badge (gray) for shows that have concluded
  - Status automatically updated during background scan

- **Manual Refresh Button**
  - "Refresh" button in header to rescan all cards on demand
  - Useful for checking updates after a show is announced

- **Checklists Collapsed by Default**
  - Checklists now start collapsed in task detail modal
  - Reduces visual clutter when opening cards
  - Click header or "Expand All" to view items

- **Worker Infrastructure** (Background Processing)
  - `TaskCoordinator` - Orchestrates task execution across workers
  - `WorkerPool` - Manages 2-4 Web Workers with auto-scaling
  - `TaskQueue` - Priority queue (high/normal/low)
  - `RateLimiter` - Per-API rate limiting
  - `MessageBus` - Pub/sub messaging system
  - `useBackgroundEnrichment` - React hook for background processing

- **AgentOrchestrator Background Mode**
  - `enableBackgroundMode()` / `disableBackgroundMode()`
  - `submitForBackground()` - Async task submission
  - `waitForBackground()` - Promise-based completion
  - `onBackgroundComplete()` - Event subscription
  - `getBackgroundStats()` - Queue/pool statistics

- **CLAUDE.md** - Claude Code configuration file
  - Post-implementation steps (type check, build, docs)
  - Commit message conventions
  - Project structure documentation

### Changed

- `TaskDetailModal.tsx` - Checklists now collapsible and searchable
- `TODO.md` - Added worker optimization tasks, marked checklist features complete

### Technical Debt Identified

- Polling-based processing (100ms interval) should be event-driven
- TaskQueue uses O(n log n) sort on every access
- RateLimiter not integrated with task dispatch
- Callback maps not cleaned up after task completion

---

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
