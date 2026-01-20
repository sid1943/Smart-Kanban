# Smart Kanban - TODO

Future improvements and features to be added.

---

## High Priority

### Search & Discovery
- [ ] Global search across all boards and tasks
- [ ] Search by task name, description, labels, checklists
- [ ] Search results with board/list context
- [ ] Recent searches history

### Task Management
- [x] Drag & drop tasks between lists (v0.3.6)
- [x] Drag & drop to reorder tasks within a list (v0.3.6)
- [ ] Bulk select and move/delete/complete tasks
- [ ] Task priority levels with sorting
- [ ] Recurring tasks

### Data & Backup
- [ ] Export all data as JSON
- [ ] Export single board as JSON
- [ ] Import from exported JSON backup
- [ ] Cloud sync option (Firebase/Supabase)

---

## Medium Priority

### Due Dates & Reminders
- [ ] Browser notifications for due dates
- [ ] Calendar view for tasks with due dates
- [ ] Overdue task highlighting
- [ ] "Due today" / "Due this week" filters

### Board & List Management
- [x] Drag & drop to reorder lists (v0.3.6)
- [ ] Rename lists inline
- [ ] Archive completed boards
- [ ] Board templates (Media, Project, Travel, etc.)
- [ ] Duplicate board functionality

### Filters & Views
- [ ] Filter by label
- [ ] Filter by due date range
- [ ] Filter by completion status
- [ ] Filter by assignee
- [ ] Save filter presets

### UI/UX Improvements
- [ ] Keyboard shortcuts (Ctrl+N new task, Ctrl+F search, etc.)
- [ ] Dark/Light theme toggle
- [ ] Better mobile responsive design
- [ ] Loading skeletons during data fetch
- [ ] Undo/Redo for task actions
- [x] Collapsible checklists (expand/collapse each checklist section)
- [x] Searchable checklists (filter items within checklists)

---

## Low Priority / Nice to Have

### Trello Import Enhancements
- [ ] Apply Trello board background to imported boards
- [ ] Show label colors in all views (not just task detail)
- [ ] Preview file attachments (images, PDFs)
- [ ] Import board activity/history

### Collaboration (Future)
- [ ] Share board via link
- [ ] Multiple user comments
- [ ] Activity log per board
- [ ] Real-time sync between users

### Integrations
- [ ] Google Calendar sync
- [ ] Export to ICS calendar format
- [ ] Webhook notifications
- [ ] API for external access

### Analytics & Insights
- [ ] Task completion stats over time
- [ ] Board activity heatmap
- [ ] Time tracking per task
- [ ] Productivity dashboard

---

## Bugs & Technical Debt

### Performance
- [ ] **Reduce scroll lag during content refresh** - Move scanning to Web Worker to avoid blocking main thread
- [ ] Use `requestIdleCallback` for non-critical background tasks

### Code Quality
- [ ] Handle localStorage quota exceeded gracefully
- [ ] Add error boundaries to all major components
- [ ] Optimize re-renders in task list
- [ ] Add unit tests for core functions
- [ ] Add E2E tests with Playwright/Cypress
- [ ] **Consolidate duplicate type definitions** - `TaskItem`, `Checklist`, `ChecklistItem` duplicated in App.tsx, TaskDetailModal.tsx, useNewContentScanner.ts
  - Create shared types in `src/types/index.ts`
- [ ] Add JSDoc comments to complex functions
- [ ] Remove hardcoded TMDb fallback API key (security concern)

### Error Handling
- [ ] Add retry logic with exponential backoff for API calls
- [ ] Show user-facing error messages for API failures
- [ ] Add offline mode indication (disable enrichment when offline)
- [ ] Validate API keys on settings save (not just prefix check)

### Content Scanner Performance (High Priority)
- [ ] **Reduce initial loading time** - Scanner currently blocks perceived load
  - Consider: Cache TMDb responses in localStorage with TTL (24h?)
  - Consider: Use Web Worker for API calls to not block main thread
  - Consider: Batch API requests where possible
  - Consider: Progressive scan (scan visible cards first, then rest)
- [ ] **Parallel API requests** - Currently sequential (250ms between each)
  - TMDb allows 40 req/10 sec - can do 3-4 concurrent requests safely
  - Use Promise.all with chunking for faster scans
- [ ] **Smart caching** - Don't re-scan unchanged cards
  - Store last scan timestamp per card
  - Only re-scan if card modified or >24h since last scan
- [ ] **Lazy scanning** - Only scan cards when they come into view
  - Use Intersection Observer for viewport-based scanning
  - Prioritize cards user is likely to see

### Worker Traffic Optimization (High Priority)
- [ ] Replace polling-based processing with event-driven approach in TaskCoordinator (100ms interval is wasteful)
- [ ] Optimize TaskQueue with heap/priority queue data structure (current O(n log n) sort on every call)
- [ ] Integrate RateLimiter with task dispatch in processTask() (rate limiter exists but unused)
- [ ] Fix memory leak - clean up callback maps after task completion (completionCallbacks/errorCallbacks grow indefinitely)
- [ ] Add backpressure mechanism with getQueuePressure() method (no feedback when queue overwhelmed)
- [ ] Add periodic cleanup interval for completed tasks (only cleans on queue full)

### Worker Infrastructure (Unused/Incomplete)
- [ ] Integrate `useBackgroundEnrichment` hook - implemented but not used in App.tsx
- [ ] Enable WorkerPool auto-scaling - currently only creates minimum workers, never scales up
- [ ] Use MessageBus for queue status updates to UI
- [ ] Document worker pool auto-scaling behavior

### Edge Cases & Bugs
- [ ] Fix year extraction regex - "Watch in 2024 - Breaking Bad (2008)" extracts wrong year
- [ ] Add `contentType !== 'unknown'` check in `isScannableTask()`
- [ ] Consider multiple signals for low-frequency keywords to reduce false positives
- [ ] Handle cache invalidation when task content type changes

---

## Smart Organization

### Content Detection (v0.3.0 - Completed)
- [x] Auto-detect content type (TV, Movie, Anime, Book, Game)
- [x] Pattern matching with confidence scoring
- [x] URL pattern detection (IMDb, TMDb, MAL, Steam, Spotify)
- [ ] Suggest categories based on content analysis
- [ ] Auto-tag based on patterns (year, genre, platform)
- [ ] Detect duplicate entries across boards

### AI-Powered Features
- [ ] Smart task suggestions based on board type
- [ ] Auto-generate checklists (e.g., seasons for TV shows)
- [ ] Content recommendations based on existing items
- [ ] Natural language task creation ("Add Breaking Bad to watchlist")

### Media-Specific Features (v0.3.0 - Completed)
- [x] Fetch metadata from TMDb/OMDb/Jikan APIs
- [x] Show ratings from multiple sources (IMDb, RT, Metacritic, MAL)
- [x] Display runtime, seasons, episodes, genres
- [x] Where to Watch - streaming availability
- [x] Franchise detection and watch order
- [ ] Track watch progress across seasons
- [ ] Mark as "Currently Watching" / "Completed" / "Dropped"

### Books & Games (v0.3.0 - Completed)
- [x] Open Library API for book metadata
- [x] RAWG API for game metadata
- [x] Quick links to external sources
- [x] Related content by same author/in series

### Engine Enhancements (Future)
- [ ] Add Music lens (Spotify/Last.fm integration)
- [ ] Add Travel lens (weather, visa, currency)
- [ ] Add Recipe lens (nutrition, ingredients)
- [ ] Configurable API keys in settings
- [ ] Offline mode with cached data
- [x] Generalized new content detection for all content types (v0.3.6)

### Cache Management
- [ ] Cache management UI (clear cache, view cache size)
- [ ] Cache statistics per content type
- [ ] Automatic old data cleanup (LRU eviction)
- [ ] Cache TTL configuration in settings

---

## Accessibility & Polish

- [ ] Keyboard navigation for card selection/movement
- [ ] Screen reader hints for drag-drop operations
- [ ] Focus management when modals open/close
- [ ] ARIA labels for all interactive elements
- [ ] High contrast mode support
- [ ] Reduce motion option for animations

---

## Performance Monitoring

- [ ] Queue statistics dashboard
- [ ] API rate limit status display
- [ ] Worker pool health monitoring
- [ ] Build size analysis and budget

---

## Completed

- [x] Trello JSON import with full data capture (v0.2.3)
- [x] Link extraction from cards (v0.2.4)
- [x] Task detail modal with clickable links (v0.2.5)
- [x] Checklist import fallback by idCard (v0.2.6)
- [x] Import confirmation before saving (v0.2.7)
- [x] Interactive checklists with add item (v0.2.7)
- [x] Link display with card titles (v0.2.8)
- [x] Improved card modal with info bar (v0.2.9)
- [x] List name formatting (snake_case to Title Case) (v0.2.9)
- [x] Basic Smart Insights - media type, year, progress (v0.2.9)
- [x] Trello label colors CSS variables (v0.2.9)
- [x] Smart Content Engine - universal detection and enrichment (v0.3.0)
- [x] Entertainment Lens - TV, Movies, Anime with TMDb/OMDb/Jikan (v0.3.0)
- [x] Leisure Lens - Books, Games with OpenLibrary/RAWG (v0.3.0)
- [x] On-demand data fetching with caching (v0.3.0)
- [x] Content type detection during import - Detect-Then-Enrich pattern (v0.3.6)
- [x] Enrichment data caching on tasks (v0.3.6)
- [x] Architecture documentation for import patterns (v0.3.6)
- [x] Fixed card moving to bottom on click (v0.3.6)
- [x] Removed pre-load enrichment screen (was causing refresh delays) (v0.3.6)
- [x] Stable card sorting with original index tiebreaker (v0.3.6)
- [x] Click-and-drag horizontal scroll for boards (v0.3.6)
- [x] Drag & drop to reorder lists/columns (v0.3.6)
- [x] Column order persists to localStorage (v0.3.6)
- [x] Cross-tab real-time sync via storage events (v0.3.6)
- [x] 24-hour API cache for enrichment data (v0.3.6)
- [x] Dynamic Workspace Blocks with grid layout (v0.3.7)
- [x] Workspace auto-detection based on content type and goal type (v0.3.7)
- [x] Workspace selection modal for new boards (v0.3.7)
- [x] Collapsible/expandable workspace blocks (v0.3.7)
- [x] Board mini-cards with progress indicators (v0.3.7)
- [x] Activity tracking for boards (lastActivityAt) (v0.3.7)
- [x] Migration of existing boards to workspaces (v0.3.7)

---

*Last updated: 2026-01-19*
