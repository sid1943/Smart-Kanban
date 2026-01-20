import { useState, useEffect, useMemo, useCallback } from 'react';
import { BoardMiniCard } from './BoardMiniCard';

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
  flipDelay?: number; // Stagger delay in ms
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
  flipDelay = 0,
  onToggleExpand,
  onSelectBoard,
  onAddBoard,
  onSizeChange,
}: WorkspaceTileProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Calculate workspace summary
  const summary: WorkspaceSummary = useMemo(() => {
    const allTasks = boards.flatMap(b => b.tasks);
    const completedTasks = allTasks.filter(t => t.checked).length;

    const recentActivity: { text: string; timestamp: number }[] = [];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get most recently active board
    const sortedBoards = [...boards].sort((a, b) =>
      (b.lastActivityAt || b.createdAt) - (a.lastActivityAt || a.createdAt)
    );

    if (sortedBoards.length > 0) {
      const mostRecent = sortedBoards[0];
      const timeAgo = Date.now() - (mostRecent.lastActivityAt || mostRecent.createdAt);
      if (timeAgo < oneDayAgo) {
        recentActivity.push({
          text: `${mostRecent.goal} updated`,
          timestamp: mostRecent.lastActivityAt || mostRecent.createdAt,
        });
      }
    }

    if (completedTasks > 0) {
      recentActivity.push({
        text: `${completedTasks} tasks completed`,
        timestamp: Date.now(),
      });
    }

    return {
      boardCount: boards.length,
      totalTasks: allTasks.length,
      completedTasks,
      recentActivity: recentActivity.slice(0, 2),
    };
  }, [boards]);

  const completionPercentage = summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0;

  // Auto-flip timer with stagger
  useEffect(() => {
    if (isHovered || isExpanded) return;

    const flipInterval = 7000 + flipDelay; // Base 7 seconds + stagger
    const timer = setInterval(() => {
      setIsFlipped(prev => !prev);
    }, flipInterval);

    // Initial delayed flip
    const initialTimer = setTimeout(() => {
      setIsFlipped(true);
      setTimeout(() => setIsFlipped(false), 3000);
    }, 3000 + flipDelay);

    return () => {
      clearInterval(timer);
      clearTimeout(initialTimer);
    };
  }, [flipDelay, isHovered, isExpanded]);

  // Pause flip on hover
  useEffect(() => {
    if (isHovered) {
      setIsFlipped(false);
    }
  }, [isHovered]);

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

  // Preview boards for back face
  const previewBoards = boards.slice(0, size === 'wide' ? 3 : 2);

  // Get activity text
  const activityText = summary.recentActivity[0]?.text ||
    (boards.length > 0 ? `${boards[0].goal}` : 'No activity');

  const renderSmallTile = () => (
    <>
      {/* Front Face - Icon and count */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-icon">{workspace.icon || workspace.name[0]}</div>
          <div className="tile-number">{summary.totalTasks}</div>
        </div>
      </div>

      {/* Back Face - Completion percentage */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content tile-back">
          <div className="tile-completion">
            <div className="tile-completion-number">{completionPercentage}%</div>
          </div>
        </div>
      </div>
    </>
  );

  const renderMediumTile = () => (
    <>
      {/* Front Face - Name, icon, stats */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-header">
            <span className="tile-title">{workspace.name}</span>
            <span className="tile-icon">{workspace.icon || workspace.name[0]}</span>
          </div>
          <div className="tile-center">
            <div className="tile-number">{summary.totalTasks}</div>
            <div className="tile-number-label">tasks</div>
          </div>
          <div className="tile-footer">
            {completionPercentage}% complete
          </div>
        </div>
      </div>

      {/* Back Face - Board previews */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-header">
            <span className="tile-title">{workspace.name}</span>
          </div>
          <div className="tile-boards-preview">
            {previewBoards.map(board => (
              <div key={board.id} className="tile-board-item">
                {board.goal}
              </div>
            ))}
            {boards.length > previewBoards.length && (
              <div className="tile-board-item" style={{ opacity: 0.7 }}>
                +{boards.length - previewBoards.length} more
              </div>
            )}
            {boards.length === 0 && (
              <div className="tile-board-item" style={{ opacity: 0.7 }}>
                No boards yet
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderWideTile = () => (
    <>
      {/* Front Face - Full overview */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-header">
            <span className="tile-title">{workspace.name}</span>
            <span className="tile-icon">{workspace.icon || workspace.name[0]}</span>
          </div>
          <div className="tile-divider" />
          <div className="tile-stats">
            <span>{summary.boardCount} board{summary.boardCount !== 1 ? 's' : ''}</span>
            <span className="tile-stats-separator">•</span>
            <span>{summary.totalTasks} task{summary.totalTasks !== 1 ? 's' : ''}</span>
            <span className="tile-stats-separator">•</span>
            <span>{completionPercentage}% complete</span>
          </div>
          <div className="tile-activity">
            <span className="tile-activity-icon">↻</span>
            <span>{activityText}</span>
          </div>
        </div>
      </div>

      {/* Back Face - Detailed stats & board list */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-header">
            <span className="tile-title">{workspace.name}</span>
            <span className="tile-icon">{workspace.icon || workspace.name[0]}</span>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginTop: '12px' }}>
            <div className="tile-completion" style={{ textAlign: 'left' }}>
              <div className="tile-completion-number" style={{ fontSize: '48px' }}>{completionPercentage}%</div>
              <div className="tile-completion-label" style={{ fontSize: '14px', marginTop: '4px' }}>complete</div>
            </div>
            <div className="tile-boards-preview" style={{ flex: 1 }}>
              {previewBoards.map(board => (
                <div key={board.id} className="tile-board-item">
                  {board.goal}
                </div>
              ))}
              {boards.length > previewBoards.length && (
                <div className="tile-board-item" style={{ opacity: 0.7 }}>
                  +{boards.length - previewBoards.length} more boards
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderTileContent = () => {
    switch (size) {
      case 'small':
        return renderSmallTile();
      case 'medium':
        return renderMediumTile();
      case 'wide':
      default:
        return renderWideTile();
    }
  };

  // If expanded, show the full content with board grid
  if (isExpanded) {
    return (
      <div
        className={`tile tile-wide`}
        style={{ gridColumn: 'span 4' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div
          className="bg-[#22272b] rounded border border-[#3d444d]/50 overflow-hidden"
          style={{ borderTop: `3px solid ${workspace.color}` }}
        >
          {/* Header */}
          <div
            onClick={onToggleExpand}
            className="p-4 cursor-pointer hover:bg-[#282e33] transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded flex items-center justify-center text-xl"
                  style={{ backgroundColor: workspace.color }}
                >
                  {workspace.icon || workspace.name[0]}
                </div>
                <div>
                  <h3 className="text-white font-semibold flex items-center gap-2">
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
                  <p className="text-[#9fadbc] text-xs mt-0.5">
                    {summary.boardCount} board{summary.boardCount !== 1 ? 's' : ''} • {summary.totalTasks} task{summary.totalTasks !== 1 ? 's' : ''} • {completionPercentage}% complete
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Board Grid */}
          <div className="px-4 pb-4 border-t border-[#3d444d]/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mt-4">
              {boards.map(board => (
                <BoardMiniCard
                  key={board.id}
                  board={board}
                  workspaceColor={workspace.color}
                  onClick={() => onSelectBoard(board.id)}
                />
              ))}

              {/* Add new board card */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onAddBoard();
                }}
                className="bg-[#282e33]/50 hover:bg-[#282e33] rounded-lg border-2 border-dashed border-[#3d444d]/50
                         hover:border-[#3d444d] min-h-[120px] flex flex-col items-center justify-center gap-2
                         cursor-pointer transition-all group"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: workspace.color + '30' }}
                >
                  <svg className="w-4 h-4 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[#9fadbc] text-xs">Create board</span>
              </div>
            </div>
          </div>
        </div>

        {/* Context Menu */}
        {contextMenu && (
          <TileContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            currentSize={size}
            onSizeChange={handleSizeChange}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    );
  }

  return (
    <>
      <div
        className={`tile tile-${size} ${isFlipped ? 'flipped' : ''}`}
        onClick={onToggleExpand}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div className="tile-inner">
          {renderTileContent()}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <TileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          currentSize={size}
          onSizeChange={handleSizeChange}
          onClose={() => setContextMenu(null)}
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
  onClose: () => void;
}

function TileContextMenu({ x, y, currentSize, onSizeChange, onClose }: TileContextMenuProps) {
  // Adjust position to stay in viewport
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - 200);

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
          <rect x="2" y="2" width="5" height="5" rx="1" />
        </svg>
        Small
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'medium' ? 'active' : ''}`}
        onClick={() => onSizeChange('medium')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="8" height="8" rx="1" />
        </svg>
        Medium
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'wide' ? 'active' : ''}`}
        onClick={() => onSizeChange('wide')}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="4" width="14" height="8" rx="1" />
        </svg>
        Wide
      </div>
    </div>
  );
}
