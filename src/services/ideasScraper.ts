import {
  ScrapedIdea,
  IdeasApiConfig,
  IdeaCategory,
  ComplexityLevel,
  MarketPotential,
} from '../types';

// Subreddits to scrape for ideas
const REDDIT_SUBREDDITS = [
  'SomebodyMakeThis',
  'AppIdeas',
  'Entrepreneur',
  'startups',
  'IndieDev',
  'webdev',
  'programming',
  'SaaS',
  'nocode',
];

// Twitter hashtags and accounts to monitor
const TWITTER_HASHTAGS = [
  'buildinpublic',
  'indiehacker',
  'startup',
  'appidea',
  'saas',
  'nocode',
  'webdev',
  'devtools',
];

const TWITTER_ACCOUNTS = [
  'IndieHackers',
  'ProductHunt',
  'StartupGrind',
  'ycombinator',
  'buildinpublic',
];

// Helper function to detect idea posts
function isIdeaPost(title: string, content = ''): boolean {
  const ideaKeywords = [
    'app idea', 'startup idea', 'build', 'create', 'develop', 'tool for',
    'somebody make', 'looking for', 'need an app', 'feature request',
    'would pay for', 'market for', 'solution for', 'problem with',
    'api for', 'saas for', 'platform for', 'service that',
    'app that', 'website that', 'bot that', 'extension for',
    'i wish there was', "why doesn't exist", 'business idea',
    'mvp', 'minimum viable product', 'prototype',
    'side project', 'weekend project',
  ];

  const text = (title + ' ' + content).toLowerCase();
  return (
    ideaKeywords.some((keyword) => text.includes(keyword)) ||
    text.includes('idea') ||
    text.includes('need') ||
    text.includes('make') ||
    text.includes('building')
  );
}

// Helper function to categorize ideas
function categorizeIdea(title: string, content = ''): IdeaCategory {
  const text = (title + ' ' + content).toLowerCase();

  if (text.includes('saas') || text.includes('subscription') || text.includes('platform'))
    return 'saas-ideas';
  if (text.includes('mobile') || text.includes('ios') || text.includes('android'))
    return 'mobile-apps';
  if (text.includes('api') || text.includes('dev') || text.includes('code') || text.includes('github'))
    return 'developer-tools';
  if (text.includes('productivity') || text.includes('workflow') || text.includes('automation'))
    return 'productivity';
  if (text.includes('no-code') || text.includes('nocode') || text.includes('drag and drop'))
    return 'no-code';
  if (text.includes('accessibility') || text.includes('disabled') || text.includes('inclusive'))
    return 'accessibility';

  return 'app-ideas';
}

// Helper function to extract technology tags
function extractTags(title: string, content = ''): string[] {
  const text = (title + ' ' + content).toLowerCase();
  const techTags: string[] = [];

  const techKeywords: Record<string, string[]> = {
    React: ['react', 'jsx', 'next.js', 'nextjs'],
    AI: ['ai', 'artificial intelligence', 'machine learning', 'ml', 'gpt', 'openai', 'chatgpt'],
    Mobile: ['mobile', 'ios', 'android', 'react native', 'flutter'],
    API: ['api', 'rest', 'graphql', 'webhook'],
    Blockchain: ['blockchain', 'crypto', 'web3', 'nft', 'ethereum'],
    SaaS: ['saas', 'subscription', 'b2b', 'enterprise'],
    'No-Code': ['no-code', 'nocode', 'low-code', 'zapier', 'airtable'],
    DevTools: ['devtools', 'developer', 'github', 'vscode', 'debugging'],
    'E-commerce': ['ecommerce', 'e-commerce', 'shopify', 'store', 'marketplace'],
    Social: ['social', 'community', 'messaging', 'chat', 'network'],
  };

  Object.entries(techKeywords).forEach(([tag, keywords]) => {
    if (keywords.some((keyword) => text.includes(keyword))) {
      techTags.push(tag);
    }
  });

  return techTags.slice(0, 4);
}

// Helper function to assess complexity
function assessComplexity(title: string, content = ''): ComplexityLevel {
  const text = (title + ' ' + content).toLowerCase();

  const highComplexityTerms = [
    'ai', 'machine learning', 'blockchain', 'distributed',
    'real-time', 'scalable', 'enterprise', 'infrastructure',
  ];
  const mediumComplexityTerms = [
    'api', 'database', 'authentication', 'payment',
    'integration', 'mobile', 'backend',
  ];

  if (highComplexityTerms.some((term) => text.includes(term))) return 'High';
  if (mediumComplexityTerms.some((term) => text.includes(term))) return 'Medium';
  return 'Low';
}

// Helper function to assess market potential
function assessMarketPotential(title: string, content = ''): MarketPotential {
  const text = (title + ' ' + content).toLowerCase();

  const highPotentialTerms = [
    'billion', 'market', 'enterprise', 'b2b', 'saas',
    'subscription', 'platform', 'scale', 'unicorn',
  ];
  const mediumPotentialTerms = [
    'startup', 'business', 'monetize', 'revenue', 'customers', 'users', 'growth',
  ];

  if (highPotentialTerms.some((term) => text.includes(term))) return 'High';
  if (mediumPotentialTerms.some((term) => text.includes(term))) return 'Medium';
  return 'Low';
}

// Extract tweet title from text
function extractTweetTitle(text: string): string {
  const cleanText = text.replace(/https?:\/\/\S+/g, '').trim();
  const sentences = cleanText.split(/[.!?]/);
  const firstSentence = sentences[0].trim();

  if (firstSentence.length > 80) {
    return firstSentence.substring(0, 80) + '...';
  }
  return firstSentence || cleanText.substring(0, 80) + '...';
}

// Reddit Scraper
export async function scrapeReddit(config: IdeasApiConfig['reddit']): Promise<ScrapedIdea[]> {
  if (!config.enabled || !config.clientId || !config.clientSecret) {
    throw new Error('Reddit API not configured');
  }

  // Get Reddit access token
  const tokenResponse = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!tokenResponse.ok) {
    throw new Error('Failed to authenticate with Reddit API');
  }

  const tokenData = await tokenResponse.json();
  const accessToken = tokenData.access_token;

  const ideas: ScrapedIdea[] = [];

  // Scrape each subreddit
  for (const subreddit of REDDIT_SUBREDDITS) {
    try {
      const response = await fetch(
        `https://oauth.reddit.com/r/${subreddit}/hot?limit=15`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'User-Agent': 'SmartTaskHub/1.0',
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.data?.children) {
        for (const post of data.data.children) {
          const postData = post.data;

          if (isIdeaPost(postData.title, postData.selftext)) {
            ideas.push({
              id: `reddit_${postData.id}`,
              platform: 'reddit',
              source: `r/${subreddit}`,
              title: postData.title,
              description: postData.selftext || postData.title,
              author: `u/${postData.author}`,
              timestamp: new Date(postData.created_utc * 1000).toISOString(),
              upvotes: postData.ups || 0,
              comments: postData.num_comments || 0,
              category: categorizeIdea(postData.title, postData.selftext),
              tags: extractTags(postData.title, postData.selftext),
              complexity: assessComplexity(postData.title, postData.selftext),
              marketPotential: assessMarketPotential(postData.title, postData.selftext),
              url: `https://reddit.com${postData.permalink}`,
              engagement: (postData.ups || 0) + (postData.num_comments || 0),
              awards: postData.all_awardings?.length || 0,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scraping r/${subreddit}:`, error);
    }
  }

  return ideas;
}

// Twitter Scraper
export async function scrapeTwitter(config: IdeasApiConfig['twitter']): Promise<ScrapedIdea[]> {
  if (!config.enabled || !config.bearerToken) {
    throw new Error('Twitter API not configured');
  }

  const ideas: ScrapedIdea[] = [];

  // Scrape hashtags
  for (const hashtag of TWITTER_HASHTAGS) {
    try {
      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=%23${hashtag} -is:retweet&tweet.fields=created_at,public_metrics,author_id&expansions=author_id&user.fields=username,name&max_results=50`,
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
          },
        }
      );

      if (!response.ok) continue;

      const data = await response.json();

      if (data.data) {
        for (const tweet of data.data) {
          if (isIdeaPost(tweet.text, '')) {
            const author = data.includes?.users?.find(
              (user: { id: string }) => user.id === tweet.author_id
            );

            ideas.push({
              id: `twitter_${tweet.id}`,
              platform: 'twitter',
              source: `#${hashtag}`,
              title: extractTweetTitle(tweet.text),
              description: tweet.text,
              author: `@${author?.username || 'unknown'}`,
              authorName: author?.name || 'Unknown User',
              timestamp: tweet.created_at,
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0,
              replies: tweet.public_metrics?.reply_count || 0,
              category: categorizeIdea(tweet.text, ''),
              tags: extractTags(tweet.text, ''),
              complexity: assessComplexity(tweet.text, ''),
              marketPotential: assessMarketPotential(tweet.text, ''),
              url: `https://twitter.com/${author?.username}/status/${tweet.id}`,
              engagement:
                (tweet.public_metrics?.like_count || 0) +
                (tweet.public_metrics?.retweet_count || 0) +
                (tweet.public_metrics?.reply_count || 0),
              impressions: tweet.public_metrics?.impression_count || 0,
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scraping #${hashtag}:`, error);
    }
  }

  // Scrape target accounts
  for (const username of TWITTER_ACCOUNTS) {
    try {
      // Get user ID
      const userResponse = await fetch(
        `https://api.twitter.com/2/users/by/username/${username}`,
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
          },
        }
      );

      if (!userResponse.ok) continue;

      const userData = await userResponse.json();
      const userId = userData.data?.id;
      if (!userId) continue;

      // Get user's tweets
      const tweetsResponse = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?tweet.fields=created_at,public_metrics&max_results=25&exclude=retweets,replies`,
        {
          headers: {
            Authorization: `Bearer ${config.bearerToken}`,
          },
        }
      );

      if (!tweetsResponse.ok) continue;

      const tweetsData = await tweetsResponse.json();

      if (tweetsData.data) {
        for (const tweet of tweetsData.data) {
          if (isIdeaPost(tweet.text, '')) {
            ideas.push({
              id: `twitter_${tweet.id}`,
              platform: 'twitter',
              source: `@${username}`,
              title: extractTweetTitle(tweet.text),
              description: tweet.text,
              author: `@${username}`,
              authorName: userData.data.name,
              timestamp: tweet.created_at,
              likes: tweet.public_metrics?.like_count || 0,
              retweets: tweet.public_metrics?.retweet_count || 0,
              replies: tweet.public_metrics?.reply_count || 0,
              category: categorizeIdea(tweet.text, ''),
              tags: extractTags(tweet.text, ''),
              complexity: assessComplexity(tweet.text, ''),
              marketPotential: assessMarketPotential(tweet.text, ''),
              url: `https://twitter.com/${username}/status/${tweet.id}`,
              engagement:
                (tweet.public_metrics?.like_count || 0) +
                (tweet.public_metrics?.retweet_count || 0) +
                (tweet.public_metrics?.reply_count || 0),
            });
          }
        }
      }
    } catch (error) {
      console.error(`Error scraping @${username}:`, error);
    }
  }

  return ideas;
}

// Combined scraper
export async function scrapeAllIdeas(
  config: IdeasApiConfig,
  onStatusChange?: (platform: 'reddit' | 'twitter', status: 'scraping' | 'success' | 'error') => void
): Promise<{ ideas: ScrapedIdea[]; errors: string[] }> {
  const allIdeas: ScrapedIdea[] = [];
  const errors: string[] = [];

  // Scrape Reddit
  if (config.reddit.enabled) {
    onStatusChange?.('reddit', 'scraping');
    try {
      const redditIdeas = await scrapeReddit(config.reddit);
      allIdeas.push(...redditIdeas);
      onStatusChange?.('reddit', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Reddit scraping failed';
      errors.push(`Reddit: ${message}`);
      onStatusChange?.('reddit', 'error');
    }
  }

  // Scrape Twitter
  if (config.twitter.enabled) {
    onStatusChange?.('twitter', 'scraping');
    try {
      const twitterIdeas = await scrapeTwitter(config.twitter);
      allIdeas.push(...twitterIdeas);
      onStatusChange?.('twitter', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Twitter scraping failed';
      errors.push(`Twitter: ${message}`);
      onStatusChange?.('twitter', 'error');
    }
  }

  // Remove duplicates by title
  const uniqueIdeas = allIdeas.filter(
    (idea, index, self) => index === self.findIndex((i) => i.title === idea.title)
  );

  return { ideas: uniqueIdeas, errors };
}

// Storage helpers
const IDEAS_CONFIG_KEY = 'smartTaskHub_ideasConfig';
const IDEAS_CACHE_KEY = 'smartTaskHub_ideasCache';

export function loadIdeasConfig(): IdeasApiConfig {
  try {
    const saved = localStorage.getItem(IDEAS_CONFIG_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading ideas config:', error);
  }
  return {
    reddit: { enabled: false, clientId: '', clientSecret: '' },
    twitter: { enabled: false, bearerToken: '' },
  };
}

export function saveIdeasConfig(config: IdeasApiConfig): void {
  localStorage.setItem(IDEAS_CONFIG_KEY, JSON.stringify(config));
}

export function loadCachedIdeas(): ScrapedIdea[] {
  try {
    const saved = localStorage.getItem(IDEAS_CACHE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading cached ideas:', error);
  }
  return [];
}

export function saveCachedIdeas(ideas: ScrapedIdea[]): void {
  localStorage.setItem(IDEAS_CACHE_KEY, JSON.stringify(ideas));
}
