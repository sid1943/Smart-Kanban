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
  tileSizes: Map<string, TileSize>;
  onSelectWorkspace: (workspaceId: string) => void;
  onTileSizeChange: (workspaceId: string, size: TileSize) => void;
}

export function TileGrid({
  workspaces,
  getBoardsForWorkspace,
  tileSizes,
  onSelectWorkspace,
  onTileSizeChange,
}: TileGridProps) {
  // Sort workspaces by order
  const sortedWorkspaces = [...workspaces].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="tile-grid">
      {sortedWorkspaces.map((workspace) => {
        const boards = getBoardsForWorkspace(workspace.id);
        // Default to 'medium' for standard tile size
        const size = tileSizes.get(workspace.id) || workspace.tileSize || 'medium';

        return (
          <WorkspaceTile
            key={workspace.id}
            workspace={workspace}
            boards={boards}
            size={size}
            onSelect={() => onSelectWorkspace(workspace.id)}
            onSizeChange={(newSize) => onTileSizeChange(workspace.id, newSize)}
          />
        );
      })}
    </div>
  );
}

// Export TileSize type for use in App.tsx
export type { TileSize };
