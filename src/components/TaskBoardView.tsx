import React from 'react';
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  SensorDescriptor,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskItem } from '../types/tasks';
import { SortableTaskColumn, SortableTaskCardWrapper, TaskInfoMatch } from './TaskBoardElements';
import { TaskDetailModal } from './TaskDetailModal';

interface TaskBoardViewProps {
  activeGoal: { goal: string; type: string } | null;
  getGoalEmoji: (type: string) => string;
  contentScanning: boolean;
  scannedCount: number;
  totalToScan: number;
  onBackToDashboard: () => void;
  onRescanContent: () => void;
  onDeleteGoal: () => void;
  boardScrollRef: React.RefObject<HTMLDivElement>;
  onBoardMouseDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onBoardMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
  onBoardMouseUp: () => void;
  onBoardMouseLeave: () => void;
  sensors: SensorDescriptor<any>[];
  activeColumnDragId: string | null;
  activeTaskDrag: TaskItem | null;
  onDragStart: (event: DragStartEvent) => void;
  onDragOver: (event: DragOverEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  stableColumnOrder: string[];
  groupedTasks: Record<string, TaskItem[]>;
  addingTaskToCategory: string | null;
  newTaskText: string;
  onSetAddingTaskToCategory: (value: string | null) => void;
  onSetNewTaskText: (value: string) => void;
  onAddTask: (text: string, category: string) => void;
  onSelectTask: (taskId: string) => void;
  getTaskInfoMatch: (task: TaskItem) => TaskInfoMatch;
  selectedTask: TaskItem | null;
  onCloseTaskDetail: () => void;
  onToggleTask: (id: string) => void;
  onEditTask: (id: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (id: string) => void;
  onToggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  onAddChecklistItem: (taskId: string, checklistId: string, text: string) => void;
  formatCategoryName: (category: string) => string;
  renderDescriptionWithLinks: (desc: string, cardTitle: string) => React.ReactNode;
  onRenameList?: (category: string, newName: string) => void;
  onDeleteList?: (category: string) => void;
  onAddList?: (name: string) => void;
}

export const TaskBoardView: React.FC<TaskBoardViewProps> = ({
  activeGoal,
  getGoalEmoji,
  contentScanning,
  scannedCount,
  totalToScan,
  onBackToDashboard,
  onRescanContent,
  onDeleteGoal,
  boardScrollRef,
  onBoardMouseDown,
  onBoardMouseMove,
  onBoardMouseUp,
  onBoardMouseLeave,
  sensors,
  activeColumnDragId,
  activeTaskDrag,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDragCancel,
  stableColumnOrder,
  groupedTasks,
  addingTaskToCategory,
  newTaskText,
  onSetAddingTaskToCategory,
  onSetNewTaskText,
  onAddTask,
  onSelectTask,
  getTaskInfoMatch,
  selectedTask,
  onCloseTaskDetail,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onToggleChecklistItem,
  onAddChecklistItem,
  formatCategoryName,
  renderDescriptionWithLinks,
  onRenameList,
  onDeleteList,
  onAddList,
}) => {
  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)),
                         url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80')`,
      }}
    >
      {/* Header */}
      <div className="bg-black/40 backdrop-blur-sm border-b border-white/10 px-4 py-2 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button
            onClick={onBackToDashboard}
            className="flex items-center gap-2 text-white/70 hover:text-white transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Home
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-white">
              {getGoalEmoji(activeGoal?.type || '')} {activeGoal?.goal}
            </h1>
            <button
              onClick={onRescanContent}
              disabled={contentScanning}
              className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full transition-all ${
                contentScanning
                  ? 'text-white/30 bg-white/5 cursor-not-allowed'
                  : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
              }`}
              title={contentScanning ? `Scanning ${scannedCount}/${totalToScan}...` : 'Check for new seasons'}
            >
              <svg className={`w-3 h-3 ${contentScanning ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {contentScanning ? '' : 'Refresh'}
            </button>
          </div>
          <button
            onClick={onDeleteGoal}
            className="p-2 text-white/50 hover:text-red-400 hover:bg-white/10 rounded transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Kanban-style board layout - click and drag to scroll horizontally */}
      <div
        ref={boardScrollRef}
        className="p-3 overflow-x-auto h-[calc(100vh-60px)]"
        onMouseDown={onBoardMouseDown}
        onMouseMove={onBoardMouseMove}
        onMouseUp={onBoardMouseUp}
        onMouseLeave={onBoardMouseLeave}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          autoScroll={
            activeColumnDragId
              ? false
              : {
                  threshold: { x: 0.1, y: 0.1 },
                  acceleration: 5,
                }
          }
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div className="flex gap-3 items-start h-full">
            {/* SortableContext for column reordering */}
            <SortableContext
              items={stableColumnOrder.map(c => `column-${c}`)}
              strategy={horizontalListSortingStrategy}
            >
              {stableColumnOrder.map(category => {
                const tasks = groupedTasks[category] || [];
                // Get display name for category
                const categoryDisplayNames: Record<string, string> = {
                  'to_watch': 'To Watch',
                  'watching': 'Watching',
                  'watched': 'Watched',
                  'dropped': 'Dropped',
                  'on_hold': 'On Hold',
                  'tasks': 'Tasks',
                  'custom': 'Custom',
                };
                const displayName = categoryDisplayNames[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <SortableTaskColumn
                    key={category}
                    category={category}
                    displayName={displayName}
                    tasks={tasks}
                    onRenameList={onRenameList}
                    onDeleteList={onDeleteList}
                  >
                  {/* Per-column SortableContext - only cards in THIS column shift */}
                  <SortableContext
                    items={tasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {tasks.map(task => {
                      const infoMatch = getTaskInfoMatch(task);
                      return (
                        <SortableTaskCardWrapper
                          key={task.id}
                          task={task}
                          onSelect={() => onSelectTask(task.id)}
                          infoMatch={infoMatch}
                        />
                      );
                    })}
                  </SortableContext>

                  {/* Add task button/form for this category */}
                  {addingTaskToCategory === category ? (
                    <div className="pt-1">
                      <input
                        type="text"
                        value={newTaskText}
                        onChange={(e) => onSetNewTaskText(e.target.value)}
                        placeholder="Enter task title..."
                        autoFocus
                        className="w-full bg-[#22272b] border border-[#5a6370] rounded-lg px-3 py-2 text-white text-sm
                                 placeholder-white/40 focus:outline-none focus:border-accent mb-2"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTaskText.trim()) {
                            onAddTask(newTaskText, category);
                          }
                          if (e.key === 'Escape') {
                            onSetAddingTaskToCategory(null);
                            onSetNewTaskText('');
                          }
                        }}
                      />
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            if (newTaskText.trim()) {
                              onAddTask(newTaskText, category);
                            }
                          }}
                          className="px-3 py-1.5 bg-[#579dff] hover:bg-[#4a8fe8] text-white text-xs font-medium rounded transition-all"
                        >
                          Add Task
                        </button>
                        <button
                          onClick={() => {
                            onSetAddingTaskToCategory(null);
                            onSetNewTaskText('');
                          }}
                          className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-[#3d444d] text-xs rounded transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        onSetAddingTaskToCategory(category);
                        onSetNewTaskText('');
                      }}
                      className="w-full px-3 py-2 text-[#9fadbc] hover:text-white hover:bg-[#22272b] text-sm
                               flex items-center gap-2 transition-all rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add a task
                    </button>
                  )}
                </SortableTaskColumn>
              );
            })}
            </SortableContext>

            {/* Add another list button/form */}
            {addingTaskToCategory === 'new_list' ? (
              <div className="w-[280px] flex-shrink-0 bg-[#101204] rounded-xl p-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => onSetNewTaskText(e.target.value)}
                  placeholder="Enter list name..."
                  autoFocus
                  className="w-full bg-[#22272b] border border-[#5a6370] rounded px-3 py-2 text-white text-sm
                           placeholder-white/40 focus:outline-none focus:border-accent mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newTaskText.trim() && onAddList) {
                      onAddList(newTaskText.trim());
                      onSetNewTaskText('');
                      onSetAddingTaskToCategory(null);
                    }
                    if (e.key === 'Escape') {
                      onSetAddingTaskToCategory(null);
                      onSetNewTaskText('');
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (newTaskText.trim() && onAddList) {
                        onAddList(newTaskText.trim());
                        onSetNewTaskText('');
                        onSetAddingTaskToCategory(null);
                      }
                    }}
                    className="px-3 py-1.5 bg-[#579dff] hover:bg-[#4a8fe8] text-white text-xs font-medium rounded transition-all"
                  >
                    Add List
                  </button>
                  <button
                    onClick={() => {
                      onSetAddingTaskToCategory(null);
                      onSetNewTaskText('');
                    }}
                    className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-[#3d444d] text-xs rounded transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => {
                  onSetAddingTaskToCategory('new_list');
                  onSetNewTaskText('');
                }}
                className="w-[280px] flex-shrink-0 px-3 py-2.5 bg-white/20 hover:bg-white/30
                         rounded-xl text-white text-sm font-medium
                         transition-all flex items-center gap-2 h-fit"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another list
              </button>
            )}
            </div>

          {/* Drag overlay - shows dragged card or column without affecting original */}
          <DragOverlay
            dropAnimation={{
              duration: 200,
              easing: 'ease',
            }}
          >
            {activeTaskDrag ? (
              <div className="rounded-lg shadow-lg px-3 py-2 bg-[#22272b] border-2 border-accent cursor-grabbing">
                <span className="text-sm text-white">{activeTaskDrag.text}</span>
              </div>
            ) : activeColumnDragId ? (
              // Column overlay
              (() => {
                const category = activeColumnDragId.replace('column-', '');
                const categoryDisplayNames: Record<string, string> = {
                  'to_watch': 'To Watch',
                  'watching': 'Watching',
                  'watched': 'Watched',
                  'dropped': 'Dropped',
                  'on_hold': 'On Hold',
                  'tasks': 'Tasks',
                  'custom': 'Custom',
                };
                const displayName = categoryDisplayNames[category] || category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                const tasks = groupedTasks[category] || [];
                return (
                  <div className="w-[280px] bg-[#101204] rounded-xl shadow-2xl border-2 border-accent cursor-grabbing opacity-90">
                    <div className="px-3 py-2.5 flex items-center justify-between">
                      <h3 className="text-[#b6c2cf] text-sm font-semibold">{displayName}</h3>
                      <span className="text-[#9fadbc] text-xs bg-[#22272b] px-2 py-0.5 rounded">{tasks.length}</span>
                    </div>
                    <div className="px-2 pb-2 space-y-2 max-h-[200px] overflow-hidden">
                      {tasks.slice(0, 3).map(task => (
                        <div key={task.id} className="rounded-lg px-3 py-2 bg-[#22272b]">
                          <span className="text-sm text-white/80">{task.text}</span>
                        </div>
                      ))}
                      {tasks.length > 3 && (
                        <div className="text-xs text-white/50 text-center py-1">
                          +{tasks.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={onCloseTaskDetail}
          onToggleTask={onToggleTask}
          onEditTask={onEditTask}
          onDeleteTask={onDeleteTask}
          onToggleChecklistItem={onToggleChecklistItem}
          onAddChecklistItem={onAddChecklistItem}
          formatCategoryName={formatCategoryName}
          renderDescriptionWithLinks={renderDescriptionWithLinks}
        />
      )}
    </div>
  );
};

export default TaskBoardView;
