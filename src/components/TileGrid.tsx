import { WorkspaceTile, TileSize } from './WorkspaceTile';

// Types matching App.tsx definitions
interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  contentType?: 'tv_series' | 'movie' | 'anime' | 'book' | 'game' | 'music' | 'unknown';
}

interface StoredGoal {
  id: string;
  goal: string;
  type: string;
  tasks: TaskItem[];
  createdAt: number;
  status: 'planning' | 'in_progress' | 'completed';
  backgroundImage?: string;
  workspaceId?: string;
  lastActivityAt?: number;
}

interface Workspace {
  id: string;
  name: string;
  color: string;
  backgroundImage?: string;
  icon?: string;
  description?: string;
  order?: number;
  tileSize?: TileSize;
}

interface TileGridProps {
  workspaces: Workspace[];
  getBoardsForWorkspace: (workspaceId: string) => StoredGoal[];
  expandedWorkspaces: Set<string>;
  tileSizes: Map<string, TileSize>;
  onToggleExpand: (workspaceId: string) => void;
  onSelectBoard: (boardId: string) => void;
  onAddBoard: () => void;
  onTileSizeChange: (workspaceId: string, size: TileSize) => void;
}

export function TileGrid({
  workspaces,
  getBoardsForWorkspace,
  expandedWorkspaces,
  tileSizes,
  onToggleExpand,
  onSelectBoard,
  onAddBoard,
  onTileSizeChange,
}: TileGridProps) {
  // Sort workspaces by order
  const sortedWorkspaces = [...workspaces].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="tile-grid">
      {sortedWorkspaces.map((workspace) => {
        const boards = getBoardsForWorkspace(workspace.id);
        const isExpanded = expandedWorkspaces.has(workspace.id);
        // Default to 'medium' for standard tile size
        const size = tileSizes.get(workspace.id) || workspace.tileSize || 'medium';

        return (
          <WorkspaceTile
            key={workspace.id}
            workspace={workspace}
            boards={boards}
            size={size}
            isExpanded={isExpanded}
            onToggleExpand={() => onToggleExpand(workspace.id)}
            onSelectBoard={onSelectBoard}
            onAddBoard={onAddBoard}
            onSizeChange={(newSize) => onTileSizeChange(workspace.id, newSize)}
          />
        );
      })}
    </div>
  );
}

// Export TileSize type for use in App.tsx
export type { TileSize };
