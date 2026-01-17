import { ConversationState, ScrapedIdea, IdeasApiConfig, IdeaCategory } from '../../types';
import {
  scrapeAllIdeas,
  loadIdeasConfig,
  saveIdeasConfig,
  loadCachedIdeas,
  saveCachedIdeas,
} from '../../services/ideasScraper';

export type IdeasStep =
  | 'initial'
  | 'configured'
  | 'scraping'
  | 'browsing'
  | 'settings';

export interface IdeasData {
  ideas?: ScrapedIdea[];
  filteredCategory?: IdeaCategory | 'all';
  filterPlatform?: 'all' | 'reddit' | 'twitter';
  sortBy?: 'trending' | 'newest' | 'popular';
  searchTerm?: string;
  lastUpdated?: string;
  error?: string;
}

export interface IdeasState extends ConversationState<IdeasStep, IdeasData> {}

export interface IdeasResponse {
  message: string;
  newState: IdeasState;
  ideas?: ScrapedIdea[];
  config?: IdeasApiConfig;
}

const IDEA_CATEGORIES = [
  { key: 'all', label: 'All Ideas' },
  { key: 'app-ideas', label: 'App Ideas' },
  { key: 'saas-ideas', label: 'SaaS Ideas' },
  { key: 'developer-tools', label: 'Developer Tools' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'no-code', label: 'No-Code' },
  { key: 'mobile-apps', label: 'Mobile Apps' },
  { key: 'accessibility', label: 'Accessibility' },
];

export async function handleIdeasMessage(
  userMessage: string,
  currentState: IdeasState | null,
  _apiKey: string
): Promise<IdeasResponse> {
  const state = currentState || getInitialIdeasState();
  const input = userMessage.toLowerCase().trim();
  const config = loadIdeasConfig();

  // Check for settings/configure commands
  if (input.includes('settings') || input.includes('configure') || input.includes('api')) {
    return showSettings(state, config);
  }

  // Check for scrape/refresh commands
  if (input.includes('scrape') || input.includes('refresh') || input.includes('fetch')) {
    return await startScraping(state, config);
  }

  // Check for filter commands
  if (input.includes('filter') || input.includes('show')) {
    return applyFilter(input, state);
  }

  // Check for sort commands
  if (input.includes('sort')) {
    return applySort(input, state);
  }

  // Check for search
  if (input.includes('search')) {
    const searchTerm = input.replace('search', '').trim();
    return applySearch(searchTerm, state);
  }

  // Initial state - show welcome
  switch (state.step) {
    case 'initial':
      return showWelcome(state, config);

    case 'configured':
    case 'browsing':
      return showBrowsingHelp(state);

    case 'settings':
      return processSettingsInput(input, state, config);

    default:
      return showWelcome(state, config);
  }
}

function showWelcome(state: IdeasState, config: IdeasApiConfig): IdeasResponse {
  const isConfigured = config.reddit.enabled || config.twitter.enabled;
  const cachedIdeas = loadCachedIdeas();

  if (!isConfigured) {
    return {
      message: `**Idea Scraper** - Discover trending startup & app ideas from Reddit and Twitter.

To get started, you'll need to configure your API credentials.

**Available Commands:**
- "settings" - Configure Reddit/Twitter API keys
- "scrape" - Fetch new ideas (requires API keys)

**Supported Sources:**
- **Reddit**: r/SomebodyMakeThis, r/AppIdeas, r/Entrepreneur, r/startups, r/SaaS, and more
- **Twitter**: #buildinpublic, #indiehacker, #startup, @IndieHackers, @ProductHunt, and more

Type "settings" to configure your API keys and start discovering ideas!`,
      newState: {
        ...state,
        step: 'initial',
      },
    };
  }

  const sources = [];
  if (config.reddit.enabled) sources.push('Reddit');
  if (config.twitter.enabled) sources.push('Twitter');

  return {
    message: `**Idea Scraper** - Ready to discover!

**Configured Sources:** ${sources.join(', ')}
${cachedIdeas.length > 0 ? `**Cached Ideas:** ${cachedIdeas.length}` : ''}

**Commands:**
- "scrape" - Fetch fresh ideas
- "filter [category]" - Filter by category (saas, mobile, devtools, etc.)
- "sort trending/newest/popular" - Change sort order
- "search [term]" - Search ideas
- "settings" - Update API configuration

${cachedIdeas.length > 0 ? 'Type "show ideas" to browse cached ideas, or "scrape" for fresh ones!' : 'Type "scrape" to fetch your first batch of ideas!'}`,
    newState: {
      ...state,
      step: 'configured',
      data: {
        ...state.data,
        ideas: cachedIdeas,
      },
    },
    ideas: cachedIdeas,
  };
}

function showSettings(state: IdeasState, config: IdeasApiConfig): IdeasResponse {
  return {
    message: `**API Configuration**

**Reddit** ${config.reddit.enabled ? '✅ Enabled' : '❌ Disabled'}
${config.reddit.enabled ? `Client ID: ${config.reddit.clientId.slice(0, 8)}...` : 'Not configured'}

**Twitter** ${config.twitter.enabled ? '✅ Enabled' : '❌ Disabled'}
${config.twitter.enabled ? 'Bearer token configured' : 'Not configured'}

To configure, use the settings panel in the Ideas view. Your API keys are stored locally in your browser.

**How to get API keys:**

**Reddit:**
1. Go to reddit.com/prefs/apps
2. Create a "script" type app
3. Copy the Client ID and Secret

**Twitter:**
1. Apply at developer.twitter.com
2. Create a project and app
3. Generate a Bearer Token

Type "back" to return to ideas.`,
    newState: {
      ...state,
      step: 'settings',
    },
    config,
  };
}

async function startScraping(state: IdeasState, config: IdeasApiConfig): Promise<IdeasResponse> {
  if (!config.reddit.enabled && !config.twitter.enabled) {
    return {
      message: 'No APIs configured! Type "settings" to set up Reddit and/or Twitter API keys.',
      newState: state,
    };
  }

  try {
    const { ideas, errors } = await scrapeAllIdeas(config);

    if (ideas.length > 0) {
      saveCachedIdeas(ideas);
    }

    let message = `**Scraping Complete!**\n\nFound **${ideas.length}** ideas.\n`;

    if (errors.length > 0) {
      message += `\n**Errors:** ${errors.join(', ')}\n`;
    }

    // Show summary by category
    const categoryCount: Record<string, number> = {};
    ideas.forEach((idea) => {
      categoryCount[idea.category] = (categoryCount[idea.category] || 0) + 1;
    });

    message += '\n**By Category:**\n';
    Object.entries(categoryCount).forEach(([cat, count]) => {
      const label = IDEA_CATEGORIES.find((c) => c.key === cat)?.label || cat;
      message += `- ${label}: ${count}\n`;
    });

    message += '\nUse "filter [category]" or "sort [trending/newest/popular]" to browse.';

    return {
      message,
      newState: {
        ...state,
        step: 'browsing',
        data: {
          ...state.data,
          ideas,
          lastUpdated: new Date().toISOString(),
          error: errors.length > 0 ? errors.join(', ') : undefined,
        },
      },
      ideas,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      message: `**Scraping Failed**\n\n${errorMessage}\n\nCheck your API configuration with "settings".`,
      newState: {
        ...state,
        step: 'configured',
        data: {
          ...state.data,
          error: errorMessage,
        },
      },
    };
  }
}

function applyFilter(input: string, state: IdeasState): IdeasResponse {
  const ideas = state.data.ideas || loadCachedIdeas();

  // Check for platform filter
  if (input.includes('reddit')) {
    const filtered = ideas.filter((i) => i.platform === 'reddit');
    return {
      message: `Showing ${filtered.length} Reddit ideas.`,
      newState: {
        ...state,
        step: 'browsing',
        data: { ...state.data, filterPlatform: 'reddit', ideas },
      },
      ideas: filtered,
    };
  }

  if (input.includes('twitter')) {
    const filtered = ideas.filter((i) => i.platform === 'twitter');
    return {
      message: `Showing ${filtered.length} Twitter ideas.`,
      newState: {
        ...state,
        step: 'browsing',
        data: { ...state.data, filterPlatform: 'twitter', ideas },
      },
      ideas: filtered,
    };
  }

  // Check for category filter
  for (const cat of IDEA_CATEGORIES) {
    if (input.includes(cat.key) || input.includes(cat.label.toLowerCase())) {
      if (cat.key === 'all') {
        return {
          message: `Showing all ${ideas.length} ideas.`,
          newState: {
            ...state,
            step: 'browsing',
            data: { ...state.data, filteredCategory: 'all', ideas },
          },
          ideas,
        };
      }
      const filtered = ideas.filter((i) => i.category === cat.key);
      return {
        message: `Showing ${filtered.length} ${cat.label} ideas.`,
        newState: {
          ...state,
          step: 'browsing',
          data: { ...state.data, filteredCategory: cat.key as IdeaCategory, ideas },
        },
        ideas: filtered,
      };
    }
  }

  return {
    message: `Available filters:\n${IDEA_CATEGORIES.map((c) => `- ${c.key}`).join('\n')}\n- reddit\n- twitter\n\nExample: "filter saas-ideas"`,
    newState: state,
    ideas,
  };
}

function applySort(input: string, state: IdeasState): IdeasResponse {
  const ideas = [...(state.data.ideas || loadCachedIdeas())];

  let sortBy: 'trending' | 'newest' | 'popular' = 'trending';
  let sortedIdeas = ideas;

  if (input.includes('newest') || input.includes('new') || input.includes('recent')) {
    sortBy = 'newest';
    sortedIdeas = ideas.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } else if (input.includes('popular')) {
    sortBy = 'popular';
    sortedIdeas = ideas.sort((a, b) => {
      const aScore = (a.upvotes || 0) + (a.likes || 0);
      const bScore = (b.upvotes || 0) + (b.likes || 0);
      return bScore - aScore;
    });
  } else {
    // Default: trending (by engagement)
    sortBy = 'trending';
    sortedIdeas = ideas.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
  }

  return {
    message: `Sorted by ${sortBy}. Showing ${sortedIdeas.length} ideas.`,
    newState: {
      ...state,
      step: 'browsing',
      data: { ...state.data, sortBy, ideas: sortedIdeas },
    },
    ideas: sortedIdeas,
  };
}

function applySearch(searchTerm: string, state: IdeasState): IdeasResponse {
  const ideas = state.data.ideas || loadCachedIdeas();

  if (!searchTerm) {
    return {
      message: 'Please provide a search term. Example: "search AI tools"',
      newState: state,
      ideas,
    };
  }

  const term = searchTerm.toLowerCase();
  const filtered = ideas.filter(
    (idea) =>
      idea.title.toLowerCase().includes(term) ||
      idea.description.toLowerCase().includes(term) ||
      idea.tags.some((tag) => tag.toLowerCase().includes(term))
  );

  return {
    message: `Found ${filtered.length} ideas matching "${searchTerm}".`,
    newState: {
      ...state,
      step: 'browsing',
      data: { ...state.data, searchTerm, ideas },
    },
    ideas: filtered,
  };
}

function showBrowsingHelp(state: IdeasState): IdeasResponse {
  const ideas = state.data.ideas || loadCachedIdeas();
  return {
    message: `**Browsing ${ideas.length} ideas**

**Commands:**
- "scrape" - Fetch fresh ideas
- "filter [category]" - Filter by category
- "filter reddit/twitter" - Filter by platform
- "sort trending/newest/popular" - Sort ideas
- "search [term]" - Search ideas
- "settings" - API configuration

**Categories:** ${IDEA_CATEGORIES.filter((c) => c.key !== 'all').map((c) => c.key).join(', ')}`,
    newState: state,
    ideas,
  };
}

function processSettingsInput(
  input: string,
  state: IdeasState,
  config: IdeasApiConfig
): IdeasResponse {
  if (input === 'back' || input === 'done') {
    return showWelcome(
      { ...state, step: 'initial' },
      config
    );
  }

  return showSettings(state, config);
}

export function getInitialIdeasState(): IdeasState {
  return {
    category: 'ideas',
    step: 'initial',
    data: {},
  };
}

// Re-export config functions for use in UI
export { loadIdeasConfig, saveIdeasConfig, loadCachedIdeas, saveCachedIdeas };
