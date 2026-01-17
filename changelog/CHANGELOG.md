# Changelog

All notable changes to Smart Kanban will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
