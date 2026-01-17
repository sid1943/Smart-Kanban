# Changelog

All notable changes to Smart Kanban will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.7] - 2026-01-17

### Fixed

#### Import Cancel Bug
- Import now requires confirmation before saving
- Clicking cancel, X button, or backdrop properly discards the import
- Changed modal title from "Import Successful" to "Import Preview"

#### Link Display in Description
- URLs used as link text are now shortened to domain name
- Example: `[https://www.imdb.com/title/tt123](url)` now shows as `imdb.com`

### Added

#### Interactive Checklists
- Checklist items are now clickable to toggle completion status
- Added "Add an item" button at bottom of each checklist
- Press Enter to add, Escape to cancel
- Progress bar and counts update in real-time

---

## [0.2.6] - 2026-01-17

### Fixed

#### Trello Import - Checklist Detection
- Fixed checklists not being imported when `card.idChecklists` is empty
- Added fallback to match checklists by `idCard` field from the checklists array
- Checklists now properly appear in imported cards

---

## [0.2.5] - 2026-01-17

### Enhanced

#### Task Detail Modal Improvements
- **Description with clickable links** - URLs and markdown links in descriptions are now rendered as clickable links
  - Markdown links `[text](url)` are properly parsed and displayed
  - Plain URLs are auto-detected and made clickable with domain name as text
  - Click anywhere in description to edit, "Edit" button to toggle modes
- **Checklists display** - Imported checklists (seasons) now show in task modal
  - Progress bar showing completion percentage
  - Individual checklist items with checkmarks
  - Scrollable list for long checklists
  - Shows checklist name and completion count
- **Extracted links section** - Links from Trello import displayed as clickable cards
  - Shows link text, URL, and source badge (description, attachment, comment)
  - External link icon for visual indication
  - Hover effects for better UX
- Modal body now scrollable with `max-h-[70vh]` for long content
- Resource link section hidden when extracted links are available

---

## [0.2.4] - 2026-01-17

### Enhanced

#### Trello Import - Link Extraction
- Added automatic link extraction from multiple sources:
  - **Card descriptions** - Markdown links `[text](url)` and plain URLs
  - **Card names** - URLs embedded in card titles
  - **Link attachments** - Non-uploaded link attachments
  - **Comments** - URLs in card comments
- Links are deduplicated across sources
- Each link tracks its source (description, attachment, name, comment)
- Domain names are extracted as link text for plain URLs
- Import modal now shows total links extracted
- New `ExtractedLink` interface for typed link data
- New `links` field on TaskItem for storing extracted links

---

## [0.2.3] - 2026-01-17

### Enhanced

#### Trello Import - Full Data Capture
The Trello JSON import now captures all data, not just surface-level information:

**New data captured:**
- **Full Checklists** - Individual checklist items with their completion state (not just counts)
- **Attachments** - File names, URLs, and types
- **Comments** - Full comment text with author and date
- **Card Position** - Cards maintain their original order within lists
- **List Position** - Lists maintain their original order
- **Cover Images** - Card cover images and colors
- **Start Dates** - Card start dates (in addition to due dates)
- **Assignees** - Member assignments on cards
- **Board Background** - Original Trello board background image

**New interfaces added:**
- `ChecklistItem`, `Checklist` - For full checklist data
- `Attachment` - For file attachments
- `Comment` - For card comments
- `TrelloAttachment`, `TrelloComment`, `TrelloMember` - Extended Trello types

**Import modal improvements:**
- Now shows detailed import statistics
- Displays count of: Cards, Lists, Checklists, Attachments, Comments
- Better visual layout with organized stat sections

---

## [0.2.2] - 2026-01-17

### Fixed

#### Board Navigation Bug
- Fixed: Clicking on a board card now properly opens the board
- Added `setViewMode('goal')` to board click handlers
- Fixed "Recently viewed" section click navigation
- Fixed "Add tasks" button in empty board cards

---

## [0.2.1] - 2026-01-17

### Changed

#### Header Redesign (`src/App.tsx`)
- Added logo with gradient icon and tagline on the left side
- Navigation buttons now show icons only on mobile, full text on larger screens
- Added visual separators between button groups
- "New Goal" button redesigned with gradient, glow shadow, and scale animation
- Ideas icon now has yellow accent color
- Overall softer, more modern look with backdrop blur effect

#### Board Cards Redesign
- Removed old cover image style, replaced with content-focused cards
- Cards now show:
  - Colored accent bar at top matching workspace color
  - Progress percentage badge
  - Preview of first 3 tasks with checkbox indicators
  - "+X more" count for additional tasks
  - Progress bar showing completion percentage
  - "X/Y completed" stats in footer
- Empty boards show "No tasks yet" with "Add tasks" button
- "Create new board" button redesigned with dashed border and circular plus icon

#### Dashboard View Improvements
- Removed "All Goals" header bar from dashboard
- Empty default columns (Travel, Learning, Fitness, Projects) no longer appear automatically
- Only columns with actual content are displayed
- Users can still add new columns via "Add another list" button

---

## [0.2.0] - 2026-01-17

### Added

#### New Components
- **ErrorBoundary** (`src/components/ErrorBoundary.tsx`)
  - React error boundary component that catches JavaScript errors in child components
  - Displays a user-friendly error message with retry and reload options
  - Prevents the entire app from crashing due to component errors

- **LoadingSkeleton** (`src/components/LoadingSkeleton.tsx`)
  - Reusable skeleton loading components for better UX during data fetching
  - Includes: `Skeleton`, `TaskSkeleton`, `TaskListSkeleton`, `MessageSkeleton`, `ChatSkeleton`, `IdeaCardSkeleton`, `IdeasGridSkeleton`, `SidebarSkeleton`, `StatCardSkeleton`
  - All skeletons include proper ARIA labels for screen readers

- **Toast Notifications** (`src/components/Toast.tsx`)
  - Toast notification system with context provider
  - Supports success, error, warning, and info message types
  - Auto-dismiss with configurable duration
  - Accessible with proper ARIA roles and live regions
  - Includes `useToast` hook for easy usage anywhere in the app

#### Custom Hooks
- **useKeyboardShortcuts** (`src/hooks/useKeyboardShortcuts.ts`)
  - Custom hook for handling keyboard shortcuts
  - Supports modifier keys (Ctrl, Shift, Alt, Meta/Cmd)
  - Automatically disables shortcuts when typing in input fields (except Escape)
  - Includes helper functions: `createShortcut`, `formatShortcut`

- **useLocalStorage** (`src/hooks/useLocalStorage.ts`)
  - Custom hook for persisting state to localStorage
  - Syncs state across browser tabs
  - Includes `useLocalStorageDate` for storing Date objects
  - Type-safe with TypeScript generics

#### Constants & Configuration
- **Constants file** (`src/constants/index.ts`)
  - Centralized configuration for storage keys, API settings, keyboard shortcuts
  - Category configurations with colors and emojis
  - Priority levels, complexity levels, market potential definitions
  - Animation durations, validation rules
  - Workspace colors and profile categories

### Improved

#### Accessibility
- Added skip link for keyboard navigation (jump to main content)
- Added `:focus-visible` styles for better keyboard focus indicators
- Added screen reader only (`.sr-only`) utility class
- Added `prefers-reduced-motion` media query support
- Added high contrast mode support with `prefers-contrast: high`
- All skeleton components include proper ARIA attributes

#### CSS Enhancements (`src/index.css`)
- Toast slide-in/slide-out animations
- Skip link styles for accessibility
- Focus visible outlines using accent color
- Reduced motion support for accessibility
- High contrast mode color adjustments

### Technical Improvements
- Better code organization with new folders: `hooks/`, `constants/`, `changelog/`
- Hooks index file for clean exports
- Consistent TypeScript types across new components

---

## [0.1.0] - Initial Release

### Features
- Grocery planning with Claude AI integration
- Recipe suggestions based on available ingredients
- Shopping list generation and management
- Idea Scraper for Reddit and Twitter
- Trello board import
- Calendar import (ICS format)
- User profile system with document storage
- Drag-and-drop task management
- Travel planning with destination-specific resources
- Learning roadmaps with curated resources
- Dark theme UI with Tailwind CSS

### Tech Stack
- React 18 with TypeScript
- Vite for build tooling
- Tailwind CSS for styling
- dnd-kit for drag-and-drop functionality
- Claude API for AI-powered features
- localStorage for data persistence
