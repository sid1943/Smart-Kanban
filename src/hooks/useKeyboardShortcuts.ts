import { useEffect, useCallback } from 'react';

type Modifier = 'ctrl' | 'shift' | 'alt' | 'meta';

interface ShortcutConfig {
  key: string;
  modifiers?: Modifier[];
  action: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable;

      for (const shortcut of shortcuts) {
        const modifiers = shortcut.modifiers || [];

        const ctrlRequired = modifiers.includes('ctrl');
        const shiftRequired = modifiers.includes('shift');
        const altRequired = modifiers.includes('alt');
        const metaRequired = modifiers.includes('meta');

        const ctrlPressed = event.ctrlKey || event.metaKey; // Support Cmd on Mac
        const shiftPressed = event.shiftKey;
        const altPressed = event.altKey;
        const metaPressed = event.metaKey;

        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = ctrlRequired === ctrlPressed;
        const shiftMatch = shiftRequired === shiftPressed;
        const altMatch = altRequired === altPressed;
        const metaMatch = metaRequired === metaPressed;

        // Skip if typing in input (unless Escape)
        if (isInput && shortcut.key !== 'Escape') {
          continue;
        }

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
          }
          shortcut.action();
          break;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

// Common shortcut helpers
export function createShortcut(
  key: string,
  action: () => void,
  modifiers?: Modifier[]
): ShortcutConfig {
  return { key, action, modifiers };
}

// Format shortcut for display
export function formatShortcut(key: string, modifiers?: Modifier[]): string {
  const parts: string[] = [];

  if (modifiers?.includes('ctrl')) parts.push('Ctrl');
  if (modifiers?.includes('shift')) parts.push('Shift');
  if (modifiers?.includes('alt')) parts.push('Alt');
  if (modifiers?.includes('meta')) parts.push('Cmd');

  parts.push(key.toUpperCase());

  return parts.join('+');
}
