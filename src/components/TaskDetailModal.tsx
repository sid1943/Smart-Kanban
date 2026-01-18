// Task Detail Modal with integrated Smart Insights
import React, { useState } from 'react';
import { useContentEnrichment } from '../hooks/useContentEnrichment';
import { getContentTypeIcon, getContentTypeName, EntertainmentData, BookData, GameData } from '../engine';

interface TaskLabel {
  name: string;
  color: string;
}

interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

interface Checklist {
  id: string;
  name: string;
  items: ChecklistItem[];
}

interface ExtractedLink {
  url: string;
  text?: string;
  source: 'description' | 'attachment' | 'name' | 'comment' | 'checklist';
  cardTitle?: string;
  checklistName?: string;
}

interface TaskItem {
  id: string;
  text: string;
  checked: boolean;
  category?: string;
  description?: string;
  link?: string;
  labels?: TaskLabel[];
  dueDate?: string;
  checklists?: Checklist[];
  checklistTotal?: number;
  checklistChecked?: number;
  links?: ExtractedLink[];
}

interface TaskDetailModalProps {
  task: TaskItem;
  onClose: () => void;
  onToggleTask: (id: string) => void;
  onEditTask: (id: string, updates: Partial<TaskItem>) => void;
  onDeleteTask: (id: string) => void;
  onToggleChecklistItem: (taskId: string, checklistId: string, itemId: string) => void;
  onAddChecklistItem: (taskId: string, checklistId: string, text: string) => void;
  formatCategoryName: (category: string) => string;
  renderDescriptionWithLinks: (desc: string, cardTitle: string) => React.ReactNode;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  onToggleTask,
  onEditTask,
  onDeleteTask,
  onToggleChecklistItem,
  onAddChecklistItem,
  formatCategoryName,
  renderDescriptionWithLinks,
}) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [addingChecklistItem, setAddingChecklistItem] = useState<string | null>(null);
  const [newChecklistItemText, setNewChecklistItemText] = useState('');

  // Fetch enriched data
  const { detection, data: enrichedData, loading: enrichLoading } = useContentEnrichment({
    title: task.text,
    description: task.description,
    listContext: task.category,
    urls: task.links?.map(l => l.url),
    checklistNames: task.checklists?.map(cl => cl.name),
  });

  // Type guards for enriched data
  const isEntertainment = enrichedData && ['tv_series', 'movie', 'anime'].includes(enrichedData.type);
  const isBook = enrichedData && enrichedData.type === 'book';
  const isGame = enrichedData && enrichedData.type === 'game';

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-start justify-center pt-16 px-4"
      onClick={onClose}
    >
      <div
        className="bg-[#1a1f26] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="sticky top-0 bg-[#1a1f26] px-6 py-4 border-b border-[#3d444d] z-10">
          {/* Top row: checkbox, title, actions */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <button
                onClick={() => onToggleTask(task.id)}
                className={`mt-1 w-6 h-6 rounded border-2 flex items-center justify-center flex-shrink-0
                          transition-all ${task.checked
                            ? 'bg-accent border-accent'
                            : 'border-[#5a6370] hover:border-accent'
                          }`}
              >
                {task.checked && (
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                {editingTitle ? (
                  <input
                    type="text"
                    defaultValue={task.text}
                    autoFocus
                    className="w-full bg-[#22272b] border border-[#5a6370] rounded px-3 py-2 text-white text-lg font-semibold
                             focus:outline-none focus:border-accent"
                    onBlur={(e) => {
                      onEditTask(task.id, { text: e.target.value });
                      setEditingTitle(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onEditTask(task.id, { text: e.currentTarget.value });
                        setEditingTitle(false);
                      }
                      if (e.key === 'Escape') setEditingTitle(false);
                    }}
                  />
                ) : (
                  <h2
                    onClick={() => setEditingTitle(true)}
                    className={`text-lg font-semibold text-white cursor-pointer hover:bg-[#22272b] rounded px-1 -mx-1
                              ${task.checked ? 'line-through opacity-60' : ''}`}
                  >
                    {task.text}
                  </h2>
                )}
                {/* List name and content type */}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="text-[#9fadbc] text-sm">{formatCategoryName(task.category || '')}</span>
                  </div>
                  {detection && detection.type !== 'unknown' && (
                    <span className="text-xs px-2 py-0.5 bg-[#3d444d] text-[#9fadbc] rounded-full flex items-center gap-1">
                      <span>{getContentTypeIcon(detection.type)}</span>
                      {getContentTypeName(detection.type)}
                    </span>
                  )}
                  {enrichLoading && !enrichedData && (
                    <span className="text-xs text-[#6b7280] flex items-center gap-1">
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditingTitle(true)}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
                title="Edit"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDeleteTask(task.id)}
                className="p-2 text-[#9fadbc] hover:text-red-400 hover:bg-[#3d444d] rounded transition-all"
                title="Delete"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Ratings Bar - Inline from enriched data */}
          {enrichedData?.ratings && enrichedData.ratings.length > 0 && (
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {enrichedData.ratings.map((rating, idx) => (
                <a
                  key={idx}
                  href={rating.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-2 py-1 bg-[#22272b] hover:bg-[#2a3038] rounded text-sm transition-all"
                >
                  <span>{rating.icon || '⭐'}</span>
                  <span className="text-white font-medium">
                    {typeof rating.score === 'number'
                      ? `${rating.score}${rating.maxScore ? `/${rating.maxScore}` : ''}`
                      : rating.score}
                  </span>
                  <span className="text-[#6b7280] text-xs">{rating.source}</span>
                </a>
              ))}
            </div>
          )}

          {/* Info Bar: Labels, Due Date, Progress */}
          {(task.labels?.length || task.dueDate || task.checklistTotal) && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {/* Labels */}
              {task.labels && task.labels.length > 0 && (
                <>
                  {task.labels.map((label, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: label.color ? `var(--trello-${label.color}, #5a6370)` : '#5a6370',
                        color: ['yellow', 'lime', 'sky'].includes(label.color || '') ? '#1a1f26' : 'white'
                      }}
                    >
                      {label.name || label.color}
                    </span>
                  ))}
                </>
              )}

              {/* Due Date */}
              {task.dueDate && (
                <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium
                  ${new Date(task.dueDate) < new Date() && !task.checked
                    ? 'bg-red-500/20 text-red-400'
                    : task.checked
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-[#3d444d] text-[#9fadbc]'
                  }`}
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              )}

              {/* Checklist Progress */}
              {task.checklistTotal && task.checklistTotal > 0 && (
                <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#3d444d] text-xs">
                  <svg className="w-3.5 h-3.5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  <div className="w-12 h-1.5 bg-[#1a1f26] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all"
                      style={{ width: `${((task.checklistChecked || 0) / task.checklistTotal) * 100}%` }}
                    />
                  </div>
                  <span className="text-[#9fadbc]">
                    {task.checklistChecked || 0}/{task.checklistTotal}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* Streaming / Where to Watch */}
          {isEntertainment && (enrichedData as EntertainmentData).streaming && (enrichedData as EntertainmentData).streaming!.length > 0 && (
            <div className="mb-4 p-3 bg-[#22272b] rounded-lg">
              <div className="text-[#6b7280] text-xs uppercase tracking-wide mb-2">Where to Watch</div>
              <div className="flex flex-wrap gap-2">
                {(enrichedData as EntertainmentData).streaming!.map((service, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1f26] rounded text-sm"
                  >
                    <span className="text-white">{service.service}</span>
                    <span className={`text-xs ${service.type === 'subscription' ? 'text-green-400' : 'text-yellow-400'}`}>
                      {service.type === 'subscription' ? '✓' : '$'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Entertainment Info (Seasons, Episodes, Status) */}
          {isEntertainment && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              {(enrichedData as EntertainmentData).yearRange && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>📅</span>
                  <span>{(enrichedData as EntertainmentData).yearRange}</span>
                </div>
              )}
              {(enrichedData as EntertainmentData).seasons && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>📺</span>
                  <span>{(enrichedData as EntertainmentData).seasons} seasons</span>
                </div>
              )}
              {(enrichedData as EntertainmentData).episodes && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>🎬</span>
                  <span>{(enrichedData as EntertainmentData).episodes} episodes</span>
                </div>
              )}
              {(enrichedData as EntertainmentData).runtime && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>⏱️</span>
                  <span>{(enrichedData as EntertainmentData).runtime}</span>
                </div>
              )}
              {(enrichedData as EntertainmentData).status && (
                <div className={`flex items-center gap-1.5 ${
                  (enrichedData as EntertainmentData).status === 'ended' ? 'text-green-400' : 'text-yellow-400'
                }`}>
                  <span>{(enrichedData as EntertainmentData).status === 'ended' ? '✓' : '▶'}</span>
                  <span>{(enrichedData as EntertainmentData).status === 'ended' ? 'Ended' : 'Ongoing'}</span>
                </div>
              )}
            </div>
          )}

          {/* Book Info */}
          {isBook && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              {(enrichedData as BookData).author && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>✍️</span>
                  <span>{(enrichedData as BookData).author}</span>
                </div>
              )}
              {(enrichedData as BookData).pages && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>📄</span>
                  <span>{(enrichedData as BookData).pages} pages</span>
                </div>
              )}
              {(enrichedData as BookData).year && (
                <div className="flex items-center gap-1.5 text-[#9fadbc]">
                  <span>📅</span>
                  <span>{(enrichedData as BookData).year}</span>
                </div>
              )}
            </div>
          )}

          {/* Game Info */}
          {isGame && (
            <div className="mb-4">
              <div className="flex flex-wrap gap-3 text-sm mb-2">
                {(enrichedData as GameData).developer && (
                  <div className="flex items-center gap-1.5 text-[#9fadbc]">
                    <span>🏢</span>
                    <span>{(enrichedData as GameData).developer}</span>
                  </div>
                )}
                {(enrichedData as GameData).playtime && (
                  <div className="flex items-center gap-1.5 text-[#9fadbc]">
                    <span>⏱️</span>
                    <span>{(enrichedData as GameData).playtime}</span>
                  </div>
                )}
              </div>
              {(enrichedData as GameData).platforms && (enrichedData as GameData).platforms!.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(enrichedData as GameData).platforms!.map((platform, idx) => (
                    <span key={idx} className="px-2 py-0.5 bg-[#3d444d] text-white text-xs rounded">
                      {platform}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Genres */}
          {enrichedData?.genres && enrichedData.genres.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1">
              {enrichedData.genres.map((genre, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-[#22272b] text-[#9fadbc] text-xs rounded">
                  {genre}
                </span>
              ))}
            </div>
          )}

          {/* Quick Links from enriched data */}
          {enrichedData?.links && enrichedData.links.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {enrichedData.links.map((link, idx) => (
                <a
                  key={idx}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#22272b] hover:bg-[#2a3038] rounded text-sm text-white transition-all"
                >
                  {link.icon && <span>{link.icon}</span>}
                  {link.name}
                  <svg className="w-3 h-3 text-[#6b7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ))}
            </div>
          )}

          {/* Description */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                <h3 className="text-[#b6c2cf] font-semibold">Description</h3>
              </div>
              {task.description && (
                <button
                  onClick={() => setEditingDescription(!editingDescription)}
                  className="text-xs text-[#9fadbc] hover:text-accent px-2 py-1 rounded hover:bg-[#3d444d] transition-all"
                >
                  {editingDescription ? 'Done' : 'Edit'}
                </button>
              )}
            </div>
            {editingDescription || !task.description ? (
              <textarea
                className="w-full bg-[#22272b] rounded-lg p-4 text-[#9fadbc] text-sm min-h-[100px]
                         border border-transparent focus:border-[#5a6370] focus:outline-none resize-none"
                placeholder="Add a more detailed description..."
                defaultValue={task.description || ''}
                onBlur={(e) => {
                  onEditTask(task.id, { description: e.target.value });
                  if (e.target.value) setEditingDescription(false);
                }}
                autoFocus={editingDescription}
              />
            ) : (
              <div
                className="bg-[#22272b] rounded-lg p-4 text-[#9fadbc] text-sm min-h-[60px] whitespace-pre-wrap cursor-pointer hover:bg-[#282e33] transition-all"
                onClick={() => setEditingDescription(true)}
              >
                {renderDescriptionWithLinks(task.description, task.text)}
              </div>
            )}
          </div>

          {/* Checklists */}
          {task.checklists && task.checklists.length > 0 && (
            <div className="mb-6">
              {task.checklists.map(checklist => {
                const checkedCount = checklist.items.filter(i => i.checked).length;
                const totalCount = checklist.items.length;
                const percentage = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

                return (
                  <div key={checklist.id} className="mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      <h4 className="text-[#b6c2cf] font-semibold flex-1">{checklist.name}</h4>
                      <span className="text-[#9fadbc] text-sm">{checkedCount}/{totalCount}</span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-2 bg-[#22272b] rounded-full mb-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${percentage === 100 ? 'bg-green-500' : 'bg-accent'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>

                    {/* Items */}
                    <div className="space-y-1 max-h-[200px] overflow-y-auto">
                      {checklist.items.map(item => (
                        <div
                          key={item.id}
                          onClick={() => onToggleChecklistItem(task.id, checklist.id, item.id)}
                          className={`flex items-center gap-2 p-2 rounded hover:bg-[#22272b] cursor-pointer transition-all
                                    ${item.checked ? 'opacity-60' : ''}`}
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0
                                        ${item.checked ? 'bg-accent border-accent' : 'border-[#5a6370]'}`}>
                            {item.checked && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm ${item.checked ? 'line-through text-[#6b7280]' : 'text-[#9fadbc]'}`}>
                            {item.text}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Add item */}
                    {addingChecklistItem === checklist.id ? (
                      <div className="mt-2">
                        <input
                          type="text"
                          value={newChecklistItemText}
                          onChange={(e) => setNewChecklistItemText(e.target.value)}
                          placeholder="Add an item..."
                          autoFocus
                          className="w-full bg-[#22272b] border border-[#5a6370] rounded px-3 py-2 text-white text-sm
                                   focus:outline-none focus:border-accent"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newChecklistItemText.trim()) {
                              onAddChecklistItem(task.id, checklist.id, newChecklistItemText.trim());
                              setNewChecklistItemText('');
                            }
                            if (e.key === 'Escape') {
                              setAddingChecklistItem(null);
                              setNewChecklistItemText('');
                            }
                          }}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setAddingChecklistItem(checklist.id)}
                        className="mt-2 text-[#9fadbc] text-sm hover:text-white flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add an item
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Extracted Links */}
          {task.links && task.links.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <h3 className="text-[#b6c2cf] font-semibold">Links ({task.links.length})</h3>
              </div>
              <div className="space-y-2">
                {task.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 bg-[#22272b] rounded-lg hover:bg-[#282e33] transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-[#3d444d] rounded flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">
                          {link.text || link.cardTitle || new URL(link.url).hostname}
                        </p>
                        <p className="text-[#6b7280] text-xs truncate">{new URL(link.url).hostname}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-[#3d444d] text-[#9fadbc] rounded capitalize">
                      {link.checklistName || link.source}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Related Content / Franchise */}
          {isEntertainment && (enrichedData as EntertainmentData).franchise && (
            <div className="mb-6 p-3 bg-[#22272b] rounded-lg">
              <div className="text-[#6b7280] text-xs uppercase tracking-wide mb-2">
                Part of: {(enrichedData as EntertainmentData).franchise!.name}
              </div>
              <div className="space-y-1">
                {(enrichedData as EntertainmentData).franchise!.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center gap-2 text-sm ${
                      (enrichedData as EntertainmentData).franchise?.position === idx + 1
                        ? 'text-accent font-medium'
                        : 'text-[#9fadbc]'
                    }`}
                  >
                    <span>{idx + 1}.</span>
                    <span>{item.title}</span>
                    {item.year && <span className="text-xs text-[#6b7280]">({item.year})</span>}
                    {(enrichedData as EntertainmentData).franchise?.position === idx + 1 && (
                      <span className="text-xs bg-accent/20 px-1.5 py-0.5 rounded">Current</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-[#b6c2cf] font-semibold">Activity</h3>
            </div>
            <div className="text-[#9fadbc] text-sm">
              {task.checked ? (
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  Task completed
                </p>
              ) : (
                <p className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  Task pending
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailModal;
