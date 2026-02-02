import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TaskItem } from '../types/tasks';
import { getContentKindLabel, isUpcoming } from '../engine/detection';

export interface TaskInfoMatch {
  matched: boolean;
  info?: { label: string; value: string; expiryDate?: string };
  profileMatch?: { label: string; value: string; expiry?: string };
  status: 'done' | 'valid' | 'expired' | 'none';
}

// Sortable + Droppable Column for Task Board (can be dragged to reorder AND accepts card drops)
export function SortableTaskColumn({
  category,
  displayName,
  tasks,
  children,
  onRenameList,
  onDeleteList,
}: {
  category: string;
  displayName: string;
  tasks: TaskItem[];
  children: React.ReactNode;
  onRenameList?: (category: string, newName: string) => void;
  onDeleteList?: (category: string) => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(displayName);

  // Sortable for column reordering
  const {
    attributes,
    listeners,
    setNodeRef: setSortableRef,
    transform,
    transition,
    isDragging: isColumnDragging,
  } = useSortable({
    id: `column-${category}`,
    data: { type: 'column', category },
  });

  // Droppable for accepting cards
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `column-${category}`,
    data: { type: 'column', category },
  });

  // Combine refs
  const setNodeRef = (node: HTMLDivElement | null) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isColumnDragging ? 0.5 : 1,
  };

  const handleRename = () => {
    if (newName.trim() && newName !== displayName && onRenameList) {
      onRenameList(category, newName.trim());
    }
    setIsRenaming(false);
    setShowMenu(false);
  };

  const handleDelete = () => {
    if (onDeleteList) {
      onDeleteList(category);
    }
    setShowMenu(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`w-[280px] flex-shrink-0 bg-[#101204] rounded-xl flex flex-col max-h-full transition-all
        ${isOver && !isColumnDragging ? 'ring-2 ring-accent/50 bg-[#1a1f26]' : ''}`}
    >
      {/* Column header - drag handle for column reordering */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRename();
              if (e.key === 'Escape') {
                setNewName(displayName);
                setIsRenaming(false);
              }
            }}
            autoFocus
            className="flex-1 bg-[#22272b] border border-[#579dff] rounded px-2 py-1 text-[#b6c2cf] text-sm font-semibold focus:outline-none"
          />
        ) : (
          <div
            {...attributes}
            {...listeners}
            className="flex-1 cursor-grab active:cursor-grabbing"
          >
            <h3 className="text-[#b6c2cf] text-sm font-semibold">
              {displayName}
            </h3>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc] text-xs bg-[#22272b] px-2 py-0.5 rounded">
            {tasks.length}
          </span>

          {/* Menu button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 text-[#9fadbc] hover:text-white hover:bg-[#22272b] rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
              </svg>
            </button>

            {/* Dropdown menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-8 z-50 w-48 bg-[#282e33] border border-[#3d444d] rounded-lg shadow-xl py-1 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setIsRenaming(true);
                      setNewName(displayName);
                      setShowMenu(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-[#b6c2cf] hover:bg-[#3d444d] flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Rename list
                  </button>
                  <button
                    onClick={handleDelete}
                    className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-[#3d444d] flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete list
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cards container */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto flex-1 min-h-[100px]">
        {children}
      </div>
    </div>
  );
}

// Sortable wrapper for task cards with full rendering
export function SortableTaskCardWrapper({
  task,
  onSelect,
  infoMatch,
}: {
  task: TaskItem;
  onSelect: () => void;
  infoMatch: TaskInfoMatch;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms ease',
    // Hide original when dragging - DragOverlay shows the visual
    opacity: isDragging ? 0 : 1,
    zIndex: isDragging ? 1000 : 1,
    touchAction: 'none',
  };

  const colorMap: Record<string, string> = {
    green: 'bg-green-600',
    yellow: 'bg-yellow-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    blue: 'bg-blue-500',
    sky: 'bg-sky-500',
    lime: 'bg-lime-500',
    pink: 'bg-pink-500',
    black: 'bg-gray-700',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-task-card="true"
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onSelect();
        }
      }}
      className={`rounded-lg shadow-sm transition-all relative cursor-grab active:cursor-grabbing px-3 py-2
        ${task.hasNewContent
          ? 'bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-[#22272b] hover:bg-[#2c323a]'
        }
        ${task.checked ? 'opacity-60' : ''}
        ${isDragging ? 'shadow-lg ring-2 ring-accent/50' : ''}`}
    >
      <div className="flex-1 min-w-0">
        {/* Labels */}
        {task.labels && task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {task.labels.map((label, idx) => (
              <span
                key={idx}
                className={`px-1.5 py-0.5 text-[10px] rounded font-medium text-white ${colorMap[label.color] || 'bg-gray-500'}`}
              >
                {label.name}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${task.checked ? 'line-through' : ''}`}>{task.text}</span>
          {task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500 text-black font-bold rounded animate-pulse">
              {task.upcomingContent
                ? (isUpcoming(task.upcomingContent.releaseDate) ? 'UPCOMING' : getContentKindLabel(task.upcomingContent.contentKind))
                : 'NEW'}
            </span>
          )}
          {task.showStatus === 'ongoing' && !task.hasNewContent && (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/30 text-blue-300 rounded">
              Returning
            </span>
          )}
          {task.showStatus === 'ended' && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-500/30 text-gray-400 rounded">
              Ended
            </span>
          )}
        </div>
        {/* Upcoming content date */}
        {task.upcomingContent && (
          <div className="text-[10px] text-amber-400 mt-0.5">
            {task.upcomingContent.title}
            {task.upcomingContent.releaseDate && (
              <> • {new Date(task.upcomingContent.releaseDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
            )}
          </div>
        )}
        {/* Checklist progress */}
        {task.checklistTotal && task.checklistTotal > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`flex items-center gap-1 text-xs ${task.checklistChecked === task.checklistTotal ? 'text-green-400' : 'text-[#9fadbc]'}`}>
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              {task.checklistChecked}/{task.checklistTotal}
            </div>
          </div>
        )}
        {infoMatch.matched && (infoMatch.info || infoMatch.profileMatch) && !task.checked && (
          <div className="flex items-center gap-1.5 mt-1">
            {infoMatch.status === 'valid' && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Valid until {new Date(infoMatch.profileMatch?.expiry || infoMatch.info?.expiryDate || '').toLocaleDateString()}
              </span>
            )}
            {infoMatch.status === 'done' && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {infoMatch.profileMatch?.label || infoMatch.info?.label}: {infoMatch.profileMatch?.value || infoMatch.info?.value}
              </span>
            )}
            {infoMatch.status === 'expired' && (
              <span className="text-xs text-red-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Expired - needs renewal!
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
