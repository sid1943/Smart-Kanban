import { useState, useMemo } from 'react';
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

interface WorkspaceBlockProps {
  workspace: Workspace;
  boards: StoredGoal[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onSelectBoard: (boardId: string) => void;
  onAddBoard: () => void;
}

export function WorkspaceBlock({
  workspace,
  boards,
  isExpanded,
  onToggleExpand,
  onSelectBoard,
  onAddBoard,
}: WorkspaceBlockProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Calculate workspace summary
  const summary: WorkspaceSummary = useMemo(() => {
    const allTasks = boards.flatMap(b => b.tasks);
    const completedTasks = allTasks.filter(t => t.checked).length;

    // Get recent activity from boards
    const recentActivity: { text: string; timestamp: number }[] = [];

    // Check for recently completed tasks (last 24 hours)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentlyCompletedCount = allTasks.filter(t => t.checked).length;

    if (recentlyCompletedCount > 0) {
      recentActivity.push({
        text: `${recentlyCompletedCount} tasks completed`,
        timestamp: Date.now(),
      });
    }

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

  // Preview boards (first 3 for collapsed state)
  const previewBoards = boards.slice(0, 3);
  const remainingCount = boards.length - previewBoards.length;

  return (
    <div
      className={`
        bg-[#22272b] rounded-xl border border-[#3d444d]/50 overflow-hidden
        transition-all duration-300 ease-in-out
        ${isExpanded ? 'col-span-full' : ''}
        ${isHovered && !isExpanded ? 'border-[#3d444d] shadow-lg' : ''}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header - always visible */}
      <div
        onClick={onToggleExpand}
        className="p-4 cursor-pointer hover:bg-[#282e33] transition-colors"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {/* Workspace icon */}
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
              style={{ backgroundColor: workspace.color + '30' }}
            >
              {workspace.icon || workspace.name[0]}
            </div>

            <div>
              <h3 className="text-white font-semibold flex items-center gap-2">
                {workspace.name}
                <svg
                  className={`w-4 h-4 text-[#9fadbc] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
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

          {/* Progress indicator */}
          {summary.totalTasks > 0 && (
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 bg-[#3d444d] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${completionPercentage}%`,
                    backgroundColor: workspace.color,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Recent activity preview (collapsed state) */}
        {!isExpanded && summary.recentActivity.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#3d444d]/50">
            {summary.recentActivity.slice(0, 1).map((activity, idx) => (
              <p key={idx} className="text-[#9fadbc] text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                {activity.text}
              </p>
            ))}
          </div>
        )}

        {/* Board preview chips (collapsed state) */}
        {!isExpanded && previewBoards.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {previewBoards.map(board => (
              <span
                key={board.id}
                className="px-2 py-0.5 bg-[#3d444d]/50 rounded text-xs text-[#b6c2cf] truncate max-w-[100px]"
              >
                {board.goal}
              </span>
            ))}
            {remainingCount > 0 && (
              <span className="px-2 py-0.5 bg-[#3d444d]/50 rounded text-xs text-[#9fadbc]">
                +{remainingCount} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Expanded content - board grid */}
      {isExpanded && (
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
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
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
      )}
    </div>
  );
}
