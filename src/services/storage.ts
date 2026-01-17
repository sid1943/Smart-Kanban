import { GroceryItem, Task, Message } from '../types';

const STORAGE_KEYS = {
  API_KEY: 'sth_api_key',
  GROCERY_LIST: 'sth_grocery_list',
  PANTRY_ITEMS: 'sth_pantry_items',
  TASKS: 'sth_tasks',
  MESSAGES: 'sth_messages',
} as const;

export const storage = {
  // API Key
  getApiKey: (): string | null => {
    return localStorage.getItem(STORAGE_KEYS.API_KEY);
  },

  setApiKey: (key: string): void => {
    localStorage.setItem(STORAGE_KEYS.API_KEY, key);
  },

  clearApiKey: (): void => {
    localStorage.removeItem(STORAGE_KEYS.API_KEY);
  },

  // Grocery List
  getGroceryList: (): GroceryItem[] => {
    const data = localStorage.getItem(STORAGE_KEYS.GROCERY_LIST);
    return data ? JSON.parse(data) : [];
  },

  setGroceryList: (items: GroceryItem[]): void => {
    localStorage.setItem(STORAGE_KEYS.GROCERY_LIST, JSON.stringify(items));
  },

  // Pantry Items
  getPantryItems: (): string[] => {
    const data = localStorage.getItem(STORAGE_KEYS.PANTRY_ITEMS);
    return data ? JSON.parse(data) : [];
  },

  setPantryItems: (items: string[]): void => {
    localStorage.setItem(STORAGE_KEYS.PANTRY_ITEMS, JSON.stringify(items));
  },

  // Tasks
  getTasks: (): Task[] => {
    const data = localStorage.getItem(STORAGE_KEYS.TASKS);
    return data ? JSON.parse(data) : [];
  },

  setTasks: (tasks: Task[]): void => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  },

  // Messages (conversation history)
  getMessages: (): Message[] => {
    const data = localStorage.getItem(STORAGE_KEYS.MESSAGES);
    if (!data) return [];
    const messages = JSON.parse(data);
    return messages.map((m: Message) => ({
      ...m,
      timestamp: new Date(m.timestamp),
    }));
  },

  setMessages: (messages: Message[]): void => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  },

  clearMessages: (): void => {
    localStorage.removeItem(STORAGE_KEYS.MESSAGES);
  },

  // Clear all data
  clearAll: (): void => {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  },
};
