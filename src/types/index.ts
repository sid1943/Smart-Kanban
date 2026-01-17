export type CategoryType = 'grocery' | 'learning' | 'process' | 'reminder' | 'ideas';

export interface Category {
  id: CategoryType;
  name: string;
  icon: string;
  description: string;
  color: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  category?: CategoryType;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity?: string;
  checked: boolean;
  category?: string;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: string[];
  missingIngredients: string[];
  instructions?: string[];
  cookTime?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  category: CategoryType;
  completed: boolean;
  dueDate?: Date;
  subtasks?: Task[];
  metadata?: Record<string, unknown>;
}

export interface ConversationState<TStep extends string = string, TData = Record<string, unknown>> {
  category: CategoryType | null;
  step: TStep;
  data: TData;
}

export interface AppState {
  apiKey: string | null;
  messages: Message[];
  currentCategory: CategoryType | null;
  conversationState: ConversationState | null;
  groceryList: GroceryItem[];
  pantryItems: string[];
  suggestedRecipes: Recipe[];
  tasks: Task[];
  ideas: ScrapedIdea[];
  ideasConfig: IdeasApiConfig;
}

// Ideas Scraper Types
export type IdeaCategory =
  | 'app-ideas'
  | 'saas-ideas'
  | 'developer-tools'
  | 'productivity'
  | 'no-code'
  | 'mobile-apps'
  | 'accessibility';

export type ComplexityLevel = 'Low' | 'Medium' | 'High';
export type MarketPotential = 'Low' | 'Medium' | 'High';
export type Platform = 'reddit' | 'twitter';

export interface ScrapedIdea {
  id: string;
  platform: Platform;
  source: string;
  title: string;
  description: string;
  author: string;
  authorName?: string;
  timestamp: string;
  url: string;
  category: IdeaCategory;
  tags: string[];
  complexity: ComplexityLevel;
  marketPotential: MarketPotential;
  engagement: number;
  // Reddit-specific
  upvotes?: number;
  comments?: number;
  awards?: number;
  // Twitter-specific
  likes?: number;
  retweets?: number;
  replies?: number;
  impressions?: number;
}

export interface IdeasApiConfig {
  reddit: {
    enabled: boolean;
    clientId: string;
    clientSecret: string;
  };
  twitter: {
    enabled: boolean;
    bearerToken: string;
  };
}

export interface IdeasScrapingStatus {
  reddit: 'idle' | 'scraping' | 'success' | 'error';
  twitter: 'idle' | 'scraping' | 'success' | 'error';
}
