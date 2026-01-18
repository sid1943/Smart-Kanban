# Changelog

All notable changes to Smart Kanban will be documented in this file.

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
