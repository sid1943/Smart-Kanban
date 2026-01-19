# Claude Code Instructions

This file contains instructions for Claude Code when working on this project.

## Project Overview

**Smart Kanban** - A Trello-like task management app with smart content detection and enrichment features.

- **Tech Stack**: React 18, TypeScript, Vite, TailwindCSS
- **Package Manager**: npm
- **Build Command**: `npm run build` (runs `tsc && vite build`)

## Post-Implementation Steps

After completing any code changes, ALWAYS run these steps:

### 1. Type Check
```bash
npx tsc --noEmit
```
Ensures no TypeScript errors were introduced.

### 2. Build Verification
```bash
npm run build
```
Confirms the project builds successfully.

### 3. Update Documentation

#### For Feature Changes:
- Update `TODO.md` - Mark completed items with `[x]`
- Update `CHANGELOG.md` - Add entry under current version
- Create daily changelog in `src/changelogs/changelog-YYYY-MM-DD.txt` if significant changes

#### For Bug Fixes:
- Update `CHANGELOG.md` under "Fixed" section
- Update `docs/ERRORS.md` if relevant

### 4. Commit Changes
```bash
git add .
git commit -m "type(scope): description"
```

**Commit Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation only
- `style` - Formatting, no code change
- `test` - Adding tests
- `chore` - Maintenance tasks

## Key Directories

```
src/
├── components/          # React components
├── engine/              # Smart Content Engine
│   ├── agents/          # Content detection agents
│   │   ├── entertainment/  # TV, Movie, Anime agents
│   │   └── leisure/        # Book, Game agents
│   └── workers/         # Web Worker infrastructure
│       ├── coordinator/ # Task coordination
│       ├── pool/        # Worker pool management
│       └── messaging/   # Message bus
├── hooks/               # React hooks
└── changelogs/          # Daily changelog files
```

## Important Files

| File | Purpose |
|------|---------|
| `TODO.md` | Feature roadmap and task tracking |
| `CHANGELOG.md` | Version history and changes |
| `docs/ARCHITECTURE.md` | System architecture documentation |
| `src/engine/types.ts` | Core type definitions |

## Coding Standards

1. **TypeScript**: Strict mode enabled, no `any` types
2. **React**: Functional components with hooks
3. **Styling**: TailwindCSS utility classes
4. **State**: React useState/useContext (no Redux)
5. **API calls**: Fetch with error handling

## Current Architecture

### Agent System
- `BaseAgent` - Abstract class for content detection
- `AgentOrchestrator` - Coordinates all agents
- Individual agents: `TVSeriesAgent`, `MovieAgent`, `AnimeAgent`, `BookAgent`, `GameAgent`

### Worker System (In Progress)
- `TaskCoordinator` - Orchestrates background tasks
- `WorkerPool` - Manages Web Workers
- `TaskQueue` - Priority queue for tasks
- `RateLimiter` - API rate limiting

## Testing

No test framework currently configured. Manual testing via:
```bash
npm run dev
```

## Common Tasks

### Adding a New Content Type Agent
1. Create agent in `src/engine/agents/[category]/`
2. Extend `BaseAgent`
3. Implement `keywords`, `urlPatterns`, `enrich()`
4. Register in `AgentOrchestrator.initializeAgents()`
5. Export from `src/engine/agents/index.ts`
6. Add type to `ContentType` in `types.ts`

### Adding a New Component
1. Create in `src/components/`
2. Use TypeScript interfaces for props
3. Follow existing naming conventions (PascalCase)
