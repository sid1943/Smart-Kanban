# Smart Kanban Architecture

This document describes the architecture of Smart Kanban, focusing on the Smart Content Engine and how components interact.

---

## Table of Contents
1. [Overview](#overview)
2. [Core Data Structures](#core-data-structures)
3. [Smart Content Engine](#smart-content-engine)
4. [Component Architecture](#component-architecture)
5. [Data Flow](#data-flow)
6. [API Integrations](#api-integrations)
7. [File Structure](#file-structure)

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

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          SMART CONTENT ENGINE                               │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     │
│  │    DETECTION    │     │   ENRICHMENT    │     │    DISPLAY      │     │
│  │                 │     │                 │     │                 │     │
│  │ ContentDetector │────►│ ContentEngine   │────►│ TaskDetailModal │     │
│  │                 │     │                 │     │ SmartInsights   │     │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘     │
│          │                       │                                        │
│          │                       │                                        │
│          ▼                       ▼                                        │
│  ┌─────────────────┐     ┌─────────────────┐                             │
│  │ Pattern Matching│     │   API Clients   │                             │
│  │ - Keywords      │     │ - TMDb          │                             │
│  │ - URL patterns  │     │ - OMDb          │                             │
│  │ - List context  │     │ - Jikan         │                             │
│  │ - Year patterns │     │ - OpenLibrary   │                             │
│  │ - Checklists    │     │ - RAWG          │                             │
│  └─────────────────┘     └─────────────────┘                             │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
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

### Enrichment Phase

**Location:** `src/engine/ContentEngine.ts`

**Process:**
1. Check cache (1-hour TTL)
2. Call appropriate API based on content type
3. Merge data from multiple APIs
4. Cache result
5. Return enriched data

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

### Import Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│ Trello JSON │────►│ Parse Cards  │────►│ For each card:  │
└─────────────┘     └──────────────┘     │ - Extract links │
                                         │ - Map checklists│
                                         │ - Set category  │
                                         └────────┬────────┘
                                                  │
                                                  ▼
                                         ┌─────────────────┐
                                         │ Store in Goals  │
                                         │ (localStorage)  │
                                         └─────────────────┘
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
│   ├── ContentEngine.ts             # Main engine (detect + enrich)
│   ├── detection/
│   │   └── ContentDetector.ts       # Pattern matching detection
│   └── enrichment/
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

### Planned Improvements
- [ ] Run detection during import, not just on modal open
- [ ] Batch API calls for multiple cards
- [ ] Offline mode with cached data
- [ ] More content types (Podcasts, Recipes, etc.)
- [ ] User preferences for default content type per list

### Performance Optimizations
- [ ] Debounce detection on rapid modal opens
- [ ] Prefetch enrichment for visible cards
- [ ] Service worker for API caching

---

*Last updated: 2026-01-18 | Version: 0.3.3*
