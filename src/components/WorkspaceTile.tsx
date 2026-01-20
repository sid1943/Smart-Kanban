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

  const completionPercentage = summary.totalTasks > 0
    ? Math.round((summary.completedTasks / summary.totalTasks) * 100)
    : 0;

  const hasRecentActivity = summary.recentActivity.length > 0;

  // Auto-flip timer - faster timing
  useEffect(() => {
    if (isHovered || isExpanded) return;

    const flipInterval = 4000 + flipDelay; // 4 seconds + stagger
    const timer = setInterval(() => {
      setIsFlipped(prev => !prev);
    }, flipInterval);

    // Initial delayed flip
    const initialTimer = setTimeout(() => {
      setIsFlipped(true);
      setTimeout(() => setIsFlipped(false), 2000);
    }, 2000 + flipDelay);

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
  const previewBoards = boards.slice(0, 2);

  const renderSmallTile = () => (
    <>
      {/* Front Face */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          {hasRecentActivity && <div className="tile-active-dot" />}
          <div className="tile-icon">{workspace.icon || workspace.name[0]}</div>
          <div className="tile-number">{summary.totalTasks}</div>
          {/* Progress bar */}
          <div className="tile-progress" style={{ width: '100%' }}>
            <div className="tile-progress-fill" style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* Back Face */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          <div className="tile-completion">
            <div className="tile-completion-number">{completionPercentage}%</div>
            <div className="tile-completion-label">done</div>
          </div>
        </div>
      </div>
    </>
  );

  const renderMediumTile = () => (
    <>
      {/* Front Face - Horizontal layout */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          {hasRecentActivity && <div className="tile-active-dot" />}
          <div className="tile-header">
            <span className="tile-title">{workspace.name}</span>
            <span className="tile-stats">
              {summary.boardCount} boards • {completionPercentage}%
            </span>
          </div>
          <div className="tile-right">
            <div className="tile-number">{summary.totalTasks}</div>
            <div className="tile-number-label">tasks</div>
          </div>
          <div className="tile-progress" style={{ width: '100%' }}>
            <div className="tile-progress-fill" style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* Back Face - Board previews */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content" style={{ flexDirection: 'column', justifyContent: 'center' }}>
          <div className="tile-boards-preview">
            {previewBoards.length > 0 ? (
              previewBoards.map(board => (
                <div key={board.id} className="tile-board-item">
                  {board.goal}
                </div>
              ))
            ) : (
              <div className="tile-board-item" style={{ opacity: 0.7 }}>No boards</div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  const renderWideTile = () => (
    <>
      {/* Front Face - Full horizontal layout */}
      <div className="tile-front" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content">
          {hasRecentActivity && <div className="tile-active-dot" />}
          <div className="tile-left">
            <span className="tile-icon">{workspace.icon || workspace.name[0]}</span>
            <div className="tile-info">
              <span className="tile-title">{workspace.name}</span>
              <span className="tile-stats">
                {summary.boardCount} boards • {summary.totalTasks} tasks • {completionPercentage}%
              </span>
            </div>
          </div>
          <div className="tile-right">
            <div className="tile-activity">
              <span className="tile-activity-icon">↻</span>
              <span>{summary.recentActivity[0]?.text || 'No activity'}</span>
            </div>
            <div className="tile-number">{summary.totalTasks}</div>
          </div>
          <div className="tile-progress" style={{ width: '100%' }}>
            <div className="tile-progress-fill" style={{ width: `${completionPercentage}%` }} />
          </div>
        </div>
      </div>

      {/* Back Face */}
      <div className="tile-back" style={{ backgroundColor: workspace.color }}>
        <div className="tile-content" style={{ flexDirection: 'row', gap: '16px' }}>
          <div className="tile-completion" style={{ flex: '0 0 auto' }}>
            <div className="tile-completion-number">{completionPercentage}%</div>
            <div className="tile-completion-label">complete</div>
          </div>
          <div className="tile-boards-preview" style={{ flex: 1 }}>
            {previewBoards.length > 0 ? (
              previewBoards.map(board => (
                <div key={board.id} className="tile-board-item">
                  {board.goal}
                </div>
              ))
            ) : (
              <div className="tile-board-item" style={{ opacity: 0.7 }}>No boards yet</div>
            )}
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
        className="tile"
        style={{ gridColumn: 'span 6' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onContextMenu={handleContextMenu}
      >
        <div
          className="bg-[#22272b] rounded border border-[#3d444d]/50 overflow-hidden"
          style={{ borderLeft: `3px solid ${workspace.color}` }}
        >
          {/* Header */}
          <div
            onClick={onToggleExpand}
            className="px-3 py-2 cursor-pointer hover:bg-[#282e33] transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded flex items-center justify-center text-sm"
                style={{ backgroundColor: workspace.color }}
              >
                {workspace.icon || workspace.name[0]}
              </div>
              <div>
                <h3 className="text-white font-medium text-sm flex items-center gap-1.5">
                  {workspace.name}
                  <svg
                    className="w-3 h-3 text-[#9fadbc] rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </h3>
                <p className="text-[#9fadbc] text-xs">
                  {summary.boardCount} boards • {summary.totalTasks} tasks • {completionPercentage}%
                </p>
              </div>
            </div>
          </div>

          {/* Board Grid */}
          <div className="px-3 pb-3 border-t border-[#3d444d]/50">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 mt-2">
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
                className="bg-[#282e33]/50 hover:bg-[#282e33] rounded border border-dashed border-[#3d444d]/50
                         hover:border-[#3d444d] min-h-[80px] flex flex-col items-center justify-center gap-1
                         cursor-pointer transition-all"
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: workspace.color + '30' }}
                >
                  <svg className="w-3 h-3 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-[#9fadbc] text-[10px]">Add board</span>
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
      <div className="tile-context-menu-header">Size</div>
      <div
        className={`tile-context-menu-item ${currentSize === 'small' ? 'active' : ''}`}
        onClick={() => onSizeChange('small')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="3" y="3" width="4" height="4" rx="1" />
        </svg>
        Small
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'medium' ? 'active' : ''}`}
        onClick={() => onSizeChange('medium')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="4" width="8" height="4" rx="1" />
        </svg>
        Medium
      </div>
      <div
        className={`tile-context-menu-item ${currentSize === 'wide' ? 'active' : ''}`}
        onClick={() => onSizeChange('wide')}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
          <rect x="1" y="4" width="12" height="4" rx="1" />
        </svg>
        Wide
      </div>
    </div>
  );
}
