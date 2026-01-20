interface Workspace {
  id: string;
  name: string;
  color: string;
  backgroundImage?: string;
  icon?: string;
  description?: string;
  order?: number;
}

interface WorkspaceSelectModalProps {
  workspaces: Workspace[];
  suggestedWorkspaceId: string | null;
  boardName: string;
  onSelect: (workspaceId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function WorkspaceSelectModal({
  workspaces,
  suggestedWorkspaceId,
  boardName,
  onSelect,
  onCreateNew,
  onCancel,
}: WorkspaceSelectModalProps) {
  // Sort workspaces by order, with suggested first
  const sortedWorkspaces = [...workspaces].sort((a, b) => {
    if (a.id === suggestedWorkspaceId) return -1;
    if (b.id === suggestedWorkspaceId) return 1;
    return (a.order ?? 0) - (b.order ?? 0);
  });

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
      onClick={onCancel}
    >
      <div
        className="bg-[#1a1f26] rounded-xl w-full max-w-md shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#3d444d]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Choose Workspace</h2>
              <p className="text-[#9fadbc] text-sm mt-0.5">
                Where should "{boardName}" go?
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Workspace options */}
        <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
          {/* Create New Workspace button */}
          <button
            onClick={onCreateNew}
            className="w-full p-4 rounded-lg text-left transition-all
                     flex items-center gap-4 group
                     bg-[#22272b] border-2 border-dashed border-[#3d444d] hover:bg-[#282e33] hover:border-[#579dff]"
          >
            {/* Plus icon */}
            <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-[#3d444d]/50 group-hover:bg-[#579dff]/20 transition-colors">
              <svg className="w-6 h-6 text-[#9fadbc] group-hover:text-[#579dff]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium group-hover:text-[#579dff]">Create New Workspace</h3>
              <p className="text-[#9fadbc] text-sm mt-0.5">
                Add a new workspace for your boards
              </p>
            </div>
          </button>

          {/* Existing workspaces */}
          {sortedWorkspaces.map(workspace => {
            const isSuggested = workspace.id === suggestedWorkspaceId;

            return (
              <button
                key={workspace.id}
                onClick={() => onSelect(workspace.id)}
                className={`
                  w-full p-4 rounded-lg text-left transition-all
                  flex items-center gap-4 group
                  ${isSuggested
                    ? 'bg-[#579dff]/10 border-2 border-[#579dff] hover:bg-[#579dff]/20'
                    : 'bg-[#22272b] border-2 border-transparent hover:bg-[#282e33] hover:border-[#3d444d]'}
                `}
              >
                {/* Workspace icon */}
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ backgroundColor: workspace.color + '30' }}
                >
                  {workspace.icon || workspace.name[0]}
                </div>

                {/* Workspace info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-medium">{workspace.name}</h3>
                    {isSuggested && (
                      <span className="px-2 py-0.5 bg-[#579dff] text-white text-xs rounded-full">
                        Suggested
                      </span>
                    )}
                  </div>
                  {workspace.description && (
                    <p className="text-[#9fadbc] text-sm mt-0.5 truncate">
                      {workspace.description}
                    </p>
                  )}
                </div>

                {/* Arrow indicator */}
                <svg
                  className="w-5 h-5 text-[#9fadbc] group-hover:text-white transition-colors flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            );
          })}

          {/* Empty state when no workspaces */}
          {sortedWorkspaces.length === 0 && (
            <div className="text-center py-6">
              <p className="text-[#9fadbc] text-sm">
                No workspaces yet. Create one to organize your boards!
              </p>
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t border-[#3d444d] bg-[#1d2125] rounded-b-xl">
          <p className="text-[#9fadbc] text-xs text-center">
            You can change the workspace later from the board settings
          </p>
        </div>
      </div>
    </div>
  );
}
