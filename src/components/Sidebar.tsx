import { ShoppingCart, BookOpen, Plane, Bell, Plus, CheckCircle2, Circle, Trash2, Lightbulb } from 'lucide-react';
import { CategoryType, GroceryItem } from '../types';

interface SidebarProps {
  currentCategory: CategoryType | null;
  onSelectCategory: (category: CategoryType | null) => void;
  groceryList: GroceryItem[];
  onToggleGroceryItem: (id: string) => void;
  onDeleteGroceryItem: (id: string) => void;
  onNewChat: () => void;
}

const categories = [
  { id: 'grocery' as const, name: 'Groceries', icon: ShoppingCart, emoji: '🥬' },
  { id: 'ideas' as const, name: 'Idea Scraper', icon: Lightbulb, emoji: '💡' },
  { id: 'learning' as const, name: 'Learning', icon: BookOpen, emoji: '📚', disabled: true },
  { id: 'process' as const, name: 'Travel/Visa', icon: Plane, emoji: '✈️', disabled: true },
  { id: 'reminder' as const, name: 'Reminders', icon: Bell, emoji: '⏰', disabled: true },
];

export function Sidebar({
  currentCategory,
  onSelectCategory,
  groceryList,
  onToggleGroceryItem,
  onDeleteGroceryItem,
  onNewChat,
}: SidebarProps) {
  const checkedCount = groceryList.filter(item => item.checked).length;

  return (
    <aside className="w-72 h-screen bg-dark-900 border-r border-dark-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-dark-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <div>
            <h1 className="font-semibold text-white">Smart Task Hub</h1>
            <p className="text-xs text-dark-400">Intelligent planning</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl
                   bg-dark-800 hover:bg-dark-700 border border-dark-700
                   text-dark-300 hover:text-white transition-smooth"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm">New Task</span>
        </button>
      </div>

      {/* Categories */}
      <div className="px-3 py-2">
        <h3 className="px-3 py-2 text-xs font-medium text-dark-500 uppercase tracking-wider">
          Categories
        </h3>
        <div className="space-y-1">
          {categories.map((category) => {
            const isActive = currentCategory === category.id;
            const isDisabled = category.disabled;

            return (
              <button
                key={category.id}
                onClick={() => !isDisabled && onSelectCategory(category.id)}
                disabled={isDisabled}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
                         transition-smooth group
                         ${isActive 
                           ? 'bg-accent/10 text-accent border border-accent/20' 
                           : isDisabled
                             ? 'text-dark-600 cursor-not-allowed'
                             : 'text-dark-300 hover:bg-dark-800 hover:text-white'
                         }`}
              >
                <span className="text-lg">{category.emoji}</span>
                <span className="flex-1 text-left">{category.name}</span>
                {isDisabled && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-dark-700 text-dark-500">
                    Soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grocery List */}
      {groceryList.length > 0 && (
        <div className="flex-1 overflow-hidden flex flex-col mt-4 border-t border-dark-800">
          <div className="px-6 py-3 flex items-center justify-between">
            <h3 className="text-xs font-medium text-dark-500 uppercase tracking-wider">
              Shopping List
            </h3>
            <span className="text-xs text-dark-500">
              {checkedCount}/{groceryList.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="space-y-1">
              {groceryList.map((item) => (
                <div
                  key={item.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg
                           hover:bg-dark-800 transition-smooth
                           ${item.checked ? 'opacity-50' : ''}`}
                >
                  <button
                    onClick={() => onToggleGroceryItem(item.id)}
                    className="text-dark-400 hover:text-accent transition-smooth"
                  >
                    {item.checked ? (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${item.checked ? 'line-through text-dark-500' : 'text-dark-200'}`}>
                    {item.quantity && <span className="text-dark-400">{item.quantity} </span>}
                    {item.name}
                  </span>
                  <button
                    onClick={() => onDeleteGroceryItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 text-dark-500 hover:text-red-400 transition-smooth"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-dark-800">
        <p className="text-xs text-dark-500 text-center">
          Smart Task Hub
        </p>
      </div>
    </aside>
  );
}
