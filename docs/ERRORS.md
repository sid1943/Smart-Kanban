# Error Log & Resolutions

This document tracks errors encountered during development and their solutions.

---

## [2026-01-17] JSX Element Missing Closing Tag

### Error
```
src/App.tsx(5168,6): error TS17008: JSX element 'div' has no corresponding closing tag.
src/App.tsx(5924,8): error TS1381: Unexpected token.
```

### Cause
After adding the Info Bar section (labels, due date, checklist progress) to the Task Detail Modal, the Modal Header `<div>` was not properly closed before the Modal Body began.

**Structure before fix:**
```tsx
{/* Modal Header */}
<div className="sticky top-0 bg-[#1a1f26] px-6 py-4 border-b border-[#3d444d]">
  {/* Top row: checkbox, title, actions */}
  <div className="flex items-start justify-between gap-3">
    ...
  </div>
</div>  {/* This closed top row, not header */}

{/* Info Bar was orphaned - inside header but header never closed */}
{(selectedTask.labels?.length || ...) && (
  <div className="px-6 py-3 bg-[#22272b]/50...">
    ...
  </div>
)}

{/* Modal Body - header div still open! */}
<div className="p-6 max-h-[70vh] overflow-y-auto">
```

### Resolution
Added missing `</div>` to close the Modal Header after the Info Bar section:

```tsx
{/* Info Bar */}
{(selectedTask.labels?.length || ...) && (
  <div className="px-6 py-3 bg-[#22272b]/50...">
    ...
  </div>
)}
</div>  {/* Added: closes Modal Header */}

{/* Modal Body */}
<div className="p-6 max-h-[70vh] overflow-y-auto">
```

### Files Modified
- `src/App.tsx` - Line ~5547

### Prevention
When adding new sections to modal components:
1. Count opening and closing div tags
2. Use proper indentation to visualize nesting
3. Run `npx tsc --noEmit` before committing to catch JSX errors

---

## [2026-01-17] Import Cancel Not Discarding Data

### Error
Clicking "Cancel" or the X button on the import modal still saved the imported data.

### Cause
The `setGoals()` function was being called immediately after parsing the Trello JSON, before showing the confirmation modal. The modal was just for display, not for confirmation.

### Resolution
1. Added `pendingImportGoal` state to hold the parsed data temporarily
2. Changed modal to show "Import Preview" instead of "Import Successful"
3. Only call `setGoals()` when user clicks the "Import" button
4. Cancel/X/backdrop click clears `pendingImportGoal` without saving

### Files Modified
- `src/App.tsx` - Added state and updated import flow

---

## [2026-01-17] Checklists Not Importing from Trello

### Error
Checklists were not appearing on imported cards even though they existed in the Trello JSON.

### Cause
The import logic was only checking `card.idChecklists` array to find matching checklists. Some Trello exports have empty `idChecklists` but still have checklists in the main `checklists` array with matching `idCard` fields.

### Resolution
Added fallback logic to match checklists by `idCard` field:

```typescript
// Primary: match by idChecklists
let cardChecklists = checklists.filter(cl => card.idChecklists?.includes(cl.id));

// Fallback: match by idCard if idChecklists is empty
if (cardChecklists.length === 0) {
  cardChecklists = checklists.filter(cl => cl.idCard === card.id);
}
```

### Files Modified
- `src/App.tsx` - Trello import parsing function

---

## [2026-01-17] Links Showing Raw URLs Instead of Titles

### Error
Links in description and extracted links sections showed full URLs like `https://www.imdb.com/title/tt1234567/` instead of meaningful names.

### Cause
The `renderDescriptionWithLinks` function and link display logic were using raw URLs as link text instead of:
1. The markdown link text
2. The card title
3. A shortened domain name

### Resolution
1. Updated `ExtractedLink` interface to include `cardTitle` and `checklistName`
2. Modified link extraction to capture card titles during import
3. Updated `renderDescriptionWithLinks` to show domain names for URL-only links
4. Links now display: markdown text > card title > domain name (fallback)

### Files Modified
- `src/App.tsx` - Interface updates and rendering logic

---

## Common TypeScript Errors (Pre-existing)

These errors exist in the codebase but don't prevent the app from running:

### TS7034/TS7005: Implicit 'any' type
```
Variable 'match' implicitly has type 'any'
```
**Location:** Lines 2526, 2535, 2566, 2595
**Status:** Non-blocking (app runs with Vite)

### TS2345: Type not assignable
```
Argument of type '"goal"' is not assignable to parameter of type 'SetStateAction<ViewMode>'
```
**Location:** Lines 3462, 3575, 3636
**Status:** ViewMode type needs to include 'goal' value

### TS2339: Property does not exist
```
Property 'completed' does not exist on type 'TaskItem'
Property 'task' does not exist on type 'TaskItem'
```
**Location:** Lines 3567, 3610, 3614, 3620, 3621
**Status:** TaskItem interface needs updating or code needs refactoring

---

*Last updated: 2026-01-17*
