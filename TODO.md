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

---

## Completed

- [x] Trello JSON import with full data capture (v0.2.3)
- [x] Link extraction from cards (v0.2.4)
- [x] Task detail modal with clickable links (v0.2.5)
- [x] Checklist import fallback by idCard (v0.2.6)
- [x] Import confirmation before saving (v0.2.7)
- [x] Interactive checklists with add item (v0.2.7)
- [x] Link display with card titles (v0.2.8)

---

*Last updated: 2026-01-17*
