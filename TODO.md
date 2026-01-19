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
- [ ] Drag & drop tasks between lists
- [ ] Drag & drop to reorder tasks within a list
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
- [ ] Drag & drop to reorder lists
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

- [ ] Handle localStorage quota exceeded gracefully
- [ ] Add error boundaries to all major components
- [ ] Optimize re-renders in task list
- [ ] Add unit tests for core functions
- [ ] Add E2E tests with Playwright/Cypress

### Worker Traffic Optimization (High Priority)
- [ ] Replace polling-based processing with event-driven approach in TaskCoordinator (100ms interval is wasteful)
- [ ] Optimize TaskQueue with heap/priority queue data structure (current O(n log n) sort on every call)
- [ ] Integrate RateLimiter with task dispatch in processTask() (rate limiter exists but unused)
- [ ] Fix memory leak - clean up callback maps after task completion (completionCallbacks/errorCallbacks grow indefinitely)
- [ ] Add backpressure mechanism with getQueuePressure() method (no feedback when queue overwhelmed)
- [ ] Add periodic cleanup interval for completed tasks (only cleans on queue full)

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
- [ ] Background refresh for ongoing shows

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

---

*Last updated: 2026-01-17*
