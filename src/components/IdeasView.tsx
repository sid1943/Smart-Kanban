import { useState, useEffect } from 'react';
import {
  ScrapedIdea,
  IdeasApiConfig,
  IdeaCategory,
  IdeasScrapingStatus,
} from '../types';
import {
  scrapeAllIdeas,
  loadIdeasConfig,
  saveIdeasConfig,
  loadCachedIdeas,
  saveCachedIdeas,
} from '../services/ideasScraper';

interface IdeasViewProps {
  onBack: () => void;
}

const IDEA_CATEGORIES: { key: IdeaCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All Ideas' },
  { key: 'app-ideas', label: 'App Ideas' },
  { key: 'saas-ideas', label: 'SaaS Ideas' },
  { key: 'developer-tools', label: 'Developer Tools' },
  { key: 'productivity', label: 'Productivity' },
  { key: 'no-code', label: 'No-Code' },
  { key: 'mobile-apps', label: 'Mobile Apps' },
  { key: 'accessibility', label: 'Accessibility' },
];

const complexityColors: Record<string, string> = {
  Low: 'bg-green-500/20 text-green-400',
  Medium: 'bg-yellow-500/20 text-yellow-400',
  High: 'bg-red-500/20 text-red-400',
};

const marketPotentialColors: Record<string, string> = {
  Low: 'bg-gray-500/20 text-gray-400',
  Medium: 'bg-blue-500/20 text-blue-400',
  High: 'bg-purple-500/20 text-purple-400',
};

export function IdeasView({ onBack }: IdeasViewProps) {
  const [ideas, setIdeas] = useState<ScrapedIdea[]>([]);
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<IdeasApiConfig>(loadIdeasConfig);
  const [showSettings, setShowSettings] = useState(false);
  const [scrapingStatus, setScrapingStatus] = useState<IdeasScrapingStatus>({
    reddit: 'idle',
    twitter: 'idle',
  });
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'reddit' | 'twitter'>('all');
  const [categoryFilter, setCategoryFilter] = useState<IdeaCategory | 'all'>('all');
  const [sortBy, setSortBy] = useState<'trending' | 'newest' | 'popular'>('trending');

  // Load cached ideas on mount
  useEffect(() => {
    const cached = loadCachedIdeas();
    if (cached.length > 0) {
      setIdeas(cached);
    }
  }, []);

  const handleScrape = async () => {
    if (!config.reddit.enabled && !config.twitter.enabled) {
      setError('No APIs configured. Click Settings to configure.');
      return;
    }

    setLoading(true);
    setError(null);
    setScrapingStatus({ reddit: 'idle', twitter: 'idle' });

    try {
      const { ideas: newIdeas, errors } = await scrapeAllIdeas(
        config,
        (platform, status) => {
          setScrapingStatus((prev) => ({ ...prev, [platform]: status }));
        }
      );

      if (newIdeas.length > 0) {
        setIdeas(newIdeas);
        saveCachedIdeas(newIdeas);
        setLastUpdated(new Date());
      }

      if (errors.length > 0) {
        setError(errors.join(' | '));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scraping failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = () => {
    saveIdeasConfig(config);
    setShowSettings(false);
  };

  const getFilteredIdeas = (): ScrapedIdea[] => {
    let filtered = [...ideas];

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter((i) => i.platform === platformFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((i) => i.category === categoryFilter);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.description.toLowerCase().includes(term) ||
          i.tags.some((t) => t.toLowerCase().includes(term))
      );
    }

    // Sort
    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        break;
      case 'popular':
        filtered.sort((a, b) => {
          const aScore = (a.upvotes || 0) + (a.likes || 0);
          const bScore = (b.upvotes || 0) + (b.likes || 0);
          return bScore - aScore;
        });
        break;
      default: // trending
        filtered.sort((a, b) => (b.engagement || 0) - (a.engagement || 0));
    }

    return filtered;
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diff = now.getTime() - then.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const StatusIcon = ({ status }: { status: IdeasScrapingStatus[keyof IdeasScrapingStatus] }) => {
    if (status === 'scraping') {
      return (
        <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      );
    }
    if (status === 'success') {
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    }
    if (status === 'error') {
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }
    return null;
  };

  const filteredIdeas = getFilteredIdeas();

  return (
    <div className="min-h-screen bg-[#1d2125]">
      {/* Header */}
      <div className="bg-[#22272b] border-b border-[#3d444d] sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>Idea Scraper</span>
                </h1>
                <p className="text-sm text-[#9fadbc]">
                  Discover trending ideas from Reddit & Twitter
                  {lastUpdated && ` • Updated ${formatTimeAgo(lastUpdated.toISOString())}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Status indicators */}
              <div className="flex items-center gap-2 text-sm text-[#9fadbc]">
                <StatusIcon status={scrapingStatus.reddit} />
                <span>Reddit</span>
                <StatusIcon status={scrapingStatus.twitter} />
                <span>Twitter</span>
              </div>

              <button
                onClick={() => setShowSettings(true)}
                className="p-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              <button
                onClick={handleScrape}
                disabled={loading || (!config.reddit.enabled && !config.twitter.enabled)}
                className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white font-medium rounded
                         transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Scraping...' : 'Scrape Now'}
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-[#22272b] border-b border-[#3d444d]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search ideas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#1d2125] border border-[#3d444d] rounded-lg
                         text-white placeholder-[#9fadbc] focus:outline-none focus:border-[#579dff]"
              />
            </div>

            {/* Platform filter */}
            <div className="flex gap-1">
              {(['all', 'reddit', 'twitter'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatformFilter(p)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all
                           ${platformFilter === p
                      ? 'bg-[#579dff] text-white'
                      : 'bg-[#3d444d] text-[#9fadbc] hover:text-white'
                    }`}
                >
                  {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-[#3d444d] border border-[#3d444d] rounded-lg text-white
                       focus:outline-none focus:border-[#579dff]"
            >
              <option value="trending">Trending</option>
              <option value="newest">Newest</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category chips */}
      <div className="bg-[#1d2125] border-b border-[#3d444d]">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {IDEA_CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all
                         ${categoryFilter === cat.key
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                    : 'bg-[#3d444d] text-[#9fadbc] hover:text-white border border-transparent'
                  }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#9fadbc]">Total Ideas</p>
                <p className="text-xl font-bold text-white">{filteredIdeas.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">🤖</span>
              </div>
              <div>
                <p className="text-sm text-[#9fadbc]">Reddit</p>
                <p className="text-xl font-bold text-white">
                  {ideas.filter((i) => i.platform === 'reddit').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <span className="text-lg">🐦</span>
              </div>
              <div>
                <p className="text-sm text-[#9fadbc]">Twitter</p>
                <p className="text-xl font-bold text-white">
                  {ideas.filter((i) => i.platform === 'twitter').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#22272b] rounded-xl p-4 border border-[#3d444d]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <p className="text-sm text-[#9fadbc]">Avg Engagement</p>
                <p className="text-xl font-bold text-white">
                  {ideas.length > 0
                    ? Math.round(ideas.reduce((sum, i) => sum + (i.engagement || 0), 0) / ideas.length)
                    : 0}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Ideas grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-4 border-[#579dff] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-[#9fadbc]">Scraping ideas from Reddit and Twitter...</p>
          </div>
        ) : filteredIdeas.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-[#3d444d] rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No ideas found</h3>
            <p className="text-[#9fadbc]">
              {!config.reddit.enabled && !config.twitter.enabled
                ? 'Configure your API settings and click "Scrape Now"'
                : 'Try adjusting your filters or scrape for fresh ideas'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredIdeas.map((idea) => (
              <div
                key={idea.id}
                className="bg-[#22272b] rounded-xl border border-[#3d444d] overflow-hidden hover:border-[#579dff]/50 transition-all"
              >
                {/* Card header */}
                <div className="p-4 border-b border-[#3d444d]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white
                                    ${idea.platform === 'reddit' ? 'bg-orange-500' : 'bg-blue-500'}`}>
                        {idea.platform === 'reddit' ? '🤖' : '🐦'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white capitalize">{idea.platform}</span>
                          <span className="text-sm text-[#9fadbc]">{idea.source}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-[#9fadbc]">
                          <span>{formatTimeAgo(idea.timestamp)}</span>
                          <span>by {idea.author}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {idea.complexity && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${complexityColors[idea.complexity]}`}>
                          {idea.complexity}
                        </span>
                      )}
                      {idea.marketPotential && (
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${marketPotentialColors[idea.marketPotential]}`}>
                          {idea.marketPotential}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card body */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-white mb-2 line-clamp-2">{idea.title}</h3>
                  <p className="text-[#9fadbc] text-sm mb-4 line-clamp-3">{idea.description}</p>

                  {idea.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {idea.tags.map((tag, i) => (
                        <span key={i} className="bg-blue-500/10 text-blue-400 text-xs px-2 py-1 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Engagement stats */}
                  <div className="flex items-center justify-between pt-4 border-t border-[#3d444d]">
                    <div className="flex items-center gap-4">
                      {idea.platform === 'reddit' ? (
                        <>
                          <div className="flex items-center gap-1 text-orange-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                            <span className="text-sm font-medium">{idea.upvotes || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-[#9fadbc]">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span className="text-sm">{idea.comments || 0}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 text-red-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                            </svg>
                            <span className="text-sm font-medium">{idea.likes || 0}</span>
                          </div>
                          <div className="flex items-center gap-1 text-green-400">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <span className="text-sm">{idea.retweets || 0}</span>
                          </div>
                        </>
                      )}
                      <div className="flex items-center gap-1 text-[#9fadbc]">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                        <span className="text-sm">{idea.engagement}</span>
                      </div>
                    </div>

                    <a
                      href={idea.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-[#3d444d] hover:bg-[#4d545d] text-white rounded-lg
                               flex items-center gap-2 text-sm transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-[#22272b] rounded-xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-[#3d444d] flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">API Configuration</h3>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 hover:bg-[#3d444d] rounded-full transition-all"
              >
                <svg className="w-5 h-5 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Reddit Config */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">🤖</span>
                    Reddit
                  </h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.reddit.enabled}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          reddit: { ...prev.reddit, enabled: e.target.checked },
                        }))
                      }
                      className="rounded border-[#3d444d] bg-[#1d2125] text-[#579dff]"
                    />
                    <span className="text-sm text-[#9fadbc]">Enable</span>
                  </label>
                </div>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Client ID"
                    value={config.reddit.clientId}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        reddit: { ...prev.reddit, clientId: e.target.value },
                      }))
                    }
                    disabled={!config.reddit.enabled}
                    className="w-full px-3 py-2 bg-[#1d2125] border border-[#3d444d] rounded-lg
                             text-white placeholder-[#9fadbc] disabled:opacity-50"
                  />
                  <input
                    type="password"
                    placeholder="Client Secret"
                    value={config.reddit.clientSecret}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        reddit: { ...prev.reddit, clientSecret: e.target.value },
                      }))
                    }
                    disabled={!config.reddit.enabled}
                    className="w-full px-3 py-2 bg-[#1d2125] border border-[#3d444d] rounded-lg
                             text-white placeholder-[#9fadbc] disabled:opacity-50"
                  />
                </div>
                <p className="text-xs text-[#9fadbc] mt-2">
                  Get credentials at{' '}
                  <a href="https://www.reddit.com/prefs/apps" target="_blank" rel="noopener noreferrer" className="text-[#579dff] hover:underline">
                    reddit.com/prefs/apps
                  </a>
                </p>
              </div>

              {/* Twitter Config */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <span className="text-xl">🐦</span>
                    Twitter
                  </h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={config.twitter.enabled}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          twitter: { ...prev.twitter, enabled: e.target.checked },
                        }))
                      }
                      className="rounded border-[#3d444d] bg-[#1d2125] text-[#579dff]"
                    />
                    <span className="text-sm text-[#9fadbc]">Enable</span>
                  </label>
                </div>
                <input
                  type="password"
                  placeholder="Bearer Token"
                  value={config.twitter.bearerToken}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      twitter: { ...prev.twitter, bearerToken: e.target.value },
                    }))
                  }
                  disabled={!config.twitter.enabled}
                  className="w-full px-3 py-2 bg-[#1d2125] border border-[#3d444d] rounded-lg
                           text-white placeholder-[#9fadbc] disabled:opacity-50"
                />
                <p className="text-xs text-[#9fadbc] mt-2">
                  Get Bearer Token at{' '}
                  <a href="https://developer.twitter.com" target="_blank" rel="noopener noreferrer" className="text-[#579dff] hover:underline">
                    developer.twitter.com
                  </a>
                </p>
              </div>

              {/* Sources info */}
              <div className="border-t border-[#3d444d] pt-4">
                <h4 className="font-semibold text-white mb-2">Data Sources</h4>
                <div className="text-sm text-[#9fadbc] space-y-1">
                  <p><strong>Reddit:</strong> r/SomebodyMakeThis, r/AppIdeas, r/Entrepreneur, r/startups, r/SaaS, r/nocode</p>
                  <p><strong>Twitter:</strong> #buildinpublic, #indiehacker, @IndieHackers, @ProductHunt, @ycombinator</p>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#3d444d] flex justify-end gap-3">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-[#9fadbc] hover:text-white hover:bg-[#3d444d] rounded-lg transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveConfig}
                className="px-4 py-2 bg-[#579dff] hover:bg-[#4a8fe8] text-white rounded-lg transition-all"
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
