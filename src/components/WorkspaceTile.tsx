import { useState, useEffect, useMemo, useCallback } from 'react';
import { BoardMiniCard } from './BoardMiniCard';

// Types matching App.tsx definitions
interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  contentType?: 'tv_series' | 'movie' | 'anime' | 'book' | 'game' | 'music' | 'unknown';
  completedAt?: number;
  createdAt?: number;
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
  tileSize?: 'small' | 'medium' | 'wide';
}

interface WorkspaceSummary {
  boardCount: number;
  totalTasks: number;
  completedTasks: number;
  recentActivity: {
    text: string;
    timestamp: number;
  }[];
}

export type TileSize = 'small' | 'medium' | 'wide';

interface WorkspaceTileProps {
  workspace: Workspace;
  boards: StoredGoal[];
  size: TileSize;
  isExpanded: boolean;
  flipDelay?: number;
  onToggleExpand: () => void;
  onSelectBoard: (boardId: string) => void;
  onAddBoard: () => void;
  onSizeChange?: (size: TileSize) => void;
}

export function WorkspaceTile({
  workspace,
  boards,
  size,
  isExpanded,
  onToggleExpand,
  onSelectBoard,
  onAddBoard,
  onSizeChange,
}: WorkspaceTileProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  // Calculate workspace summary
  const summary: WorkspaceSummary = useMemo(() => {
    const allTasks = boards.flatMap(b => b.tasks);
    const completedTasks = allTasks.filter(t => t.checked).length;

    const recentActivity: { text: string; timestamp: number }[] = [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    const sortedBoards = [...boards].sort((a, b) =>
      (b.lastActivityAt || b.createdAt) - (a.lastActivityAt || a.createdAt)
    );

    if (sortedBoards.length > 0) {
      const mostRecent = sortedBoards[0];
      const timeAgo = Date.now() - (mostRecent.lastActivityAt || mostRecent.createdAt);
      if (timeAgo < oneDayAgo) {
        recentActivity.push({
          text: mostRecent.goal,
          timestamp: mostRecent.lastActivityAt || mostRecent.createdAt,
        });
      }
    }

    return {
      boardCount: boards.length,
      totalTasks: allTasks.length,
      completedTasks,
      recentActivity: recentActivity.slice(0, 2),
    };
  }, [boards]);

  // Get recently completed tasks (last 5)
  const recentlyCompleted = useMemo(() => {
    const completed: { task: TaskItem; boardName: string }[] = [];

    for (const board of boards) {
      for (const task of board.tasks) {
        if (task.checked) {
          completed.push({ task, boardName: board.goal });
        }
      }
    }

    // Sort by completion time if available, otherwise just take last ones
    return completed.slice(-3).reverse();
  }, [boards]);

  // Get upcoming/unfinished tasks (next 3)
  const upcomingTasks = useMemo(() => {
    const upcoming: { task: TaskItem; boardName: string }[] = [];

    for (const board of boards) {
      for (const task of board.tasks) {
        if (!task.checked && upcoming.length < 3) {
          upcoming.push({ task, boardName: board.goal });
        }
      }
      if (upcoming.length >= 3) break;
    }

    return upcoming;
  }, [boards]);

  const completionPercentage = summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0;

  const remainingTasks = summary.totalTasks - summary.completedTasks;
  const hasRecentActivity = summary.recentActivity.length > 0;

  // Animate progress bar on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(completionPercentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [completionPercentage]);

  // Context menu handler
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [contextMenu]);

  const handleSizeChange = useCallback((newSize: TileSize) => {
    onSizeChange?.(newSize);
    setContextMenu(null);
  }, [onSizeChange]);

  // Format time ago
  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // If expanded, show the full content with board grid
  if (isExpanded) {
    return (
      <div
        className="live-tile live-tile-expanded"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div
          className="bg-[#22272b] rounded-lg border border-[#3d444d]/50 overflow-hidden"
          style={{ borderLeft: `4px solid ${workspace.color}` }}
        >
          {/* Header */}
          <div
            onClick={onToggleExpand}
            className="px-4 py-3 cursor-pointer hover:bg-[#282e33] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                style={{ backgroundColor: workspace.color }}
              >
                {workspace.icon || workspace.name[0]}
              </div>
              <div>
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  {workspace.name}
                  <svg
                    className="w-4 h-4 text-[#9fadbc] rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </h3>
                <p className="text-[#9fadbc] text-sm">
                  {summary.boardCount} boards • {summary.totalTasks} tasks • {completionPercentage}% complete
                </p>
              </div>
            </div>
          </div>

          {/* Board Grid */}
          <div className="px-4 pb-4 border-t border-[#3d444d]/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 mt-3">
              {boards.map(board => (
                <BoardMiniCard
                  key={board.id}
                  board={board}
                  workspaceColor={workspace.color}
                  onClick={() => onSelectBoard(board.id)}
                />
              ))}

              {/* Add board */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBoard();
                }}
                className="bg-[#282e33]/50 hover:bg-[#282e33] rounded-lg border border-dashed border-[#3d444d]/50
                         hover:border-[#579dff] min-h-[100px] flex flex-col items-center justify-center gap-2
                         cursor-pointer transition-all group"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                  style={{ backgroundColor: workspace.color + '30' }}
                >
                  <svg className="w-4 h-4 text-[#9fadbc] group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[#9fadbc] text-xs group-hover:text-white transition-colors">Add board</span>
              </div>
            </div>
          </div>
        </div>

        {contextMenu && (
          <TileContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            currentSize={size}
            onSizeChange={handleSizeChange}
          />
        )}
      </div>
    );
  }

  // Main tile view - single large square with all info
  return (
    <>
      <div
        className={`live-tile live-tile-${size}`}
        onClick={onToggleExpand}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
        style={{
          backgroundColor: workspace.color,
          '--tile-color': workspace.color,
        } as React.CSSProperties}
      >
        {/* Activity indicator */}
        {hasRecentActivity && (
          <div className="live-tile-pulse" />
        )}

        {/* Header */}
        <div className="live-tile-header">
          {workspace.icon && (
            <div className="live-tile-icon">{workspace.icon}</div>
          )}
          <h3 className="live-tile-title">{workspace.name}</h3>
        </div>

        {/* Stats Grid */}
        <div className="live-tile-stats-grid">
          <div className="live-tile-stat">
            <span className="live-tile-stat-value">{summary.boardCount}</span>
            <span className="live-tile-stat-label">Boards</span>
          </div>
          <div className="live-tile-stat">
            <span className="live-tile-stat-value">{summary.totalTasks}</span>
            <span className="live-tile-stat-label">Tasks</span>
          </div>
          <div className="live-tile-stat">
            <span className="live-tile-stat-value">{summary.completedTasks}</span>
            <span className="live-tile-stat-label">Done</span>
          </div>
          <div className="live-tile-stat">
            <span className="live-tile-stat-value live-tile-stat-remaining">{remainingTasks}</span>
            <span className="live-tile-stat-label">Left</span>
          </div>
        </div>

        {/* Recent Activity Section */}
        {recentlyCompleted.length > 0 && (
          <div className="live-tile-section">
            <div className="live-tile-section-header">
              <span className="live-tile-section-icon">&#10003;</span>
              Recently Done
            </div>
            <div className="live-tile-task-list">
              {recentlyCompleted.map((item, idx) => (
                <div key={idx} className="live-tile-task live-tile-task-done">
                  <span className="live-tile-task-check">&#10003;</span>
                  <span className="live-tile-task-text">{item.task.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming Tasks Section */}
        {upcomingTasks.length > 0 && (
          <div className="live-tile-section">
            <div className="live-tile-section-header">
              <span className="live-tile-section-icon">&#9675;</span>
              Next Up
            </div>
            <div className="live-tile-task-list">
              {upcomingTasks.map((item, idx) => (
                <div key={idx} className="live-tile-task">
                  <span className="live-tile-task-circle">&#9675;</span>
                  <span className="live-tile-task-text">{item.task.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {summary.totalTasks === 0 && (
          <div className="live-tile-empty">
            <span>No tasks yet</span>
            <span className="live-tile-empty-sub">Click to add boards</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="live-tile-progress-container">
          <div className="live-tile-progress-bar">
            <div
              className="live-tile-progress-fill"
              style={{ width: `${animatedProgress}%` }}
            />
          </div>
          <span className="live-tile-progress-text">{completionPercentage}%</span>
        </div>
      </div>

      {contextMenu && (
        <TileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentSize={size}
          onSizeChange={handleSizeChange}
        />
      )}
    </>
  );
}

// Context Menu Component
interface TileContextMenuProps {
  x: number;
  y: number;
  currentSize: TileSize;
  onSizeChange: (size: TileSize) => void;
}

function TileContextMenu({ x, y, currentSize, onSizeChange }: TileContextMenuProps) {
  const adjustedX = Math.min(x, window.innerWidth - 160);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      className="tile-context-menu"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="tile-context-menu-header">Tile Size</div>
      <div
        className={`tile-context-menu-item ${currentSize === 'small' ? 'active' : ''}`}
        onClick={() => onSizeChange('small')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="4" y="4" width="8" height="8" rx="1" />
        </svg>
        Compact
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'medium' ? 'active' : ''}`}
        onClick={() => onSizeChange('medium')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="3" width="12" height="10" rx="1" />
        </svg>
        Standard
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'wide' ? 'active' : ''}`}
        onClick={() => onSizeChange('wide')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="2" width="14" height="12" rx="1" />
        </svg>
        Large
      </div>
    </div>
  );
}
