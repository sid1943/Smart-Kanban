// App metadata
export const APP_NAME = 'Smart Task Hub';
export const APP_VERSION = '0.2.0';

// Storage keys
export const STORAGE_KEYS = {
  API_KEY: 'sth_api_key',
  GROCERY_LIST: 'sth_grocery_list',
  PANTRY_ITEMS: 'sth_pantry_items',
  TASKS: 'sth_tasks',
  MESSAGES: 'sth_messages',
  USER_INFO: 'sth_user_info',
  WORKSPACES: 'sth_workspaces',
  GOALS: 'sth_goals',
  CALENDAR_EVENTS: 'sth_calendar_events',
  IDEAS_CONFIG: 'smartTaskHub_ideasConfig',
  IDEAS_CACHE: 'smartTaskHub_ideasCache',
  THEME: 'sth_theme',
} as const;

// API configuration
export const API_CONFIG = {
  CLAUDE_URL: 'https://api.anthropic.com/v1/messages',
  CLAUDE_MODEL: 'claude-sonnet-4-20250514',
  CLAUDE_VERSION: '2023-06-01',
  MAX_TOKENS: 1024,
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  NEW_TASK: { key: 'n', modifiers: ['ctrl'] },
  SEARCH: { key: '/', modifiers: [] },
  ESCAPE: { key: 'Escape', modifiers: [] },
  SAVE: { key: 's', modifiers: ['ctrl'] },
  TOGGLE_SIDEBAR: { key: 'b', modifiers: ['ctrl'] },
} as const;

// Category configurations
export const CATEGORIES = {
  grocery: { id: 'grocery', name: 'Groceries', emoji: '🥬', color: '#10b981' },
  ideas: { id: 'ideas', name: 'Idea Scraper', emoji: '💡', color: '#8b5cf6' },
  learning: { id: 'learning', name: 'Learning', emoji: '📚', color: '#3b82f6' },
  process: { id: 'process', name: 'Travel/Visa', emoji: '✈️', color: '#f59e0b' },
  reminder: { id: 'reminder', name: 'Reminders', emoji: '⏰', color: '#ef4444' },
} as const;

// Priority levels
export const PRIORITIES = {
  low: { label: 'Low', color: '#22c55e' },
  medium: { label: 'Medium', color: '#f59e0b' },
  high: { label: 'High', color: '#ef4444' },
} as const;

// Complexity levels for ideas
export const COMPLEXITY_LEVELS = {
  Low: { label: 'Low', color: 'bg-green-500/20 text-green-400' },
  Medium: { label: 'Medium', color: 'bg-yellow-500/20 text-yellow-400' },
  High: { label: 'High', color: 'bg-red-500/20 text-red-400' },
} as const;

// Market potential levels
export const MARKET_POTENTIAL = {
  Low: { label: 'Low', color: 'bg-gray-500/20 text-gray-400' },
  Medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-400' },
  High: { label: 'High', color: 'bg-purple-500/20 text-purple-400' },
} as const;

// Idea categories
export const IDEA_CATEGORIES = [
  { key: 'all', label: 'All Ideas' },
  { key: 'app-ideas', label: 'App Ideas' },
  { key: 'saas-ideas', label: 'SaaS Ideas' },
  { key: 'developer-tools', label: 'Developer Tools' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'no-code', label: 'No-Code' },
  { key: 'mobile-apps', label: 'Mobile Apps' },
  { key: 'accessibility', label: 'Accessibility' },
] as const;

// Animation durations (ms)
export const ANIMATIONS = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Validation
export const VALIDATION = {
  MIN_TASK_LENGTH: 1,
  MAX_TASK_LENGTH: 500,
  MIN_API_KEY_LENGTH: 20,
} as const;

// Default workspace colors
export const WORKSPACE_COLORS = [
  '#0079bf', // Blue
  '#519839', // Green
  '#b04632', // Red
  '#89609e', // Purple
  '#cd5a91', // Pink
  '#4bbf6b', // Light Green
  '#00aecc', // Cyan
  '#838c91', // Gray
] as const;

// Profile categories
export const PROFILE_CATEGORIES = [
  { id: 'travel', name: 'Travel Documents', icon: '✈️' },
  { id: 'identity', name: 'Identity Documents', icon: '🪪' },
  { id: 'health', name: 'Health Information', icon: '🏥' },
  { id: 'skills', name: 'Skills & Tools', icon: '💻' },
  { id: 'education', name: 'Education & Certifications', icon: '🎓' },
] as const;
