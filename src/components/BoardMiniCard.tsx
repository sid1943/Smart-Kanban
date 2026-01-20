interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
}

interface StoredGoal {
  id: string;
  goal: string;
  type: string;
  tasks: TaskItem[];
  createdAt: number;
  status: 'planning' | 'in_progress' | 'completed';
  backgroundImage?: string;
  lastActivityAt?: number;
}

interface BoardMiniCardProps {
  board: StoredGoal;
  workspaceColor: string;
  onClick: () => void;
}

export function BoardMiniCard({ board, workspaceColor, onClick }: BoardMiniCardProps) {
  const tasks = board.tasks || [];
  const completedTasks = tasks.filter(t => t.checked).length;
  const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

  return (
    <div
      onClick={onClick}
      className="bg-[#2d333b] hover:bg-[#363d47] rounded-lg overflow-hidden cursor-pointer
                 transition-all group border border-transparent hover:border-[#3d444d]"
    >
      {/* Color bar at top */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: workspaceColor }}
      />

      <div className="p-3">
        {/* Board title */}
        <h4 className="text-white text-sm font-medium truncate mb-2">{board.goal}</h4>

        {/* Progress bar */}
        {tasks.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-[#9fadbc] mb-1">
              <span>{completedTasks}/{tasks.length}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 bg-[#3d444d] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${progress}%`,
                  backgroundColor: progress === 100 ? '#4ade80' : workspaceColor,
                }}
              />
            </div>
          </div>
        )}

        {/* Task preview - show first 2 tasks */}
        {tasks.length > 0 ? (
          <div className="space-y-1">
            {tasks.slice(0, 2).map((task, idx) => (
              <div key={idx} className="flex items-center gap-1.5 text-xs">
                <div
                  className={`w-2.5 h-2.5 rounded-sm border flex-shrink-0 flex items-center justify-center
                            ${task.checked
                              ? 'bg-green-500/20 border-green-500/50'
                              : 'border-[#3d444d]'}`}
                >
                  {task.checked && (
                    <svg className="w-1.5 h-1.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className={`truncate ${task.checked ? 'text-[#9fadbc] line-through' : 'text-[#b6c2cf]'}`}>
                  {task.text}
                </span>
              </div>
            ))}
            {tasks.length > 2 && (
              <p className="text-[#9fadbc] text-xs pl-4">+{tasks.length - 2} more</p>
            )}
          </div>
        ) : (
          <p className="text-[#9fadbc] text-xs text-center py-2">No tasks yet</p>
        )}
      </div>
    </div>
  );
}
