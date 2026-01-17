// Smart Insights Component
// Displays enriched content data in the task modal

import React, { useState, useEffect } from 'react';
import {
  detect,
  enrich,
  getContentTypeIcon,
  getContentTypeName,
  EnrichedData,
  EntertainmentData,
  BookData,
  GameData,
  ContentRating,
  DetectionResult,
} from '../engine';

interface SmartInsightsProps {
  title: string;
  description?: string;
  listContext?: string;
  urls?: string[];
}

export const SmartInsights: React.FC<SmartInsightsProps> = ({
  title,
  description,
  listContext,
  urls,
}) => {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [enrichedData, setEnrichedData] = useState<EnrichedData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Detect content type on mount
  useEffect(() => {
    const allText = `${title} ${description || ''}`;
    const result = detect(allText, listContext, urls);
    setDetection(result);
  }, [title, description, listContext, urls]);

  // Fetch enriched data when expanded
  const handleEnrich = async () => {
    if (enrichedData || loading || !detection) return;

    setLoading(true);
    setError(null);

    try {
      const result = await enrich(title, detection.type, listContext, urls);
      if (result.success && result.data) {
        setEnrichedData(result.data);
      } else {
        setError(result.error || 'Failed to fetch data');
      }
    } catch (err) {
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (!expanded && !enrichedData) {
      handleEnrich();
    }
    setExpanded(!expanded);
  };

  if (!detection || detection.type === 'unknown' || detection.confidence < 30) {
    return null;
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-[#22272b] to-[#2a3038]
                   rounded-lg hover:from-[#2a3038] hover:to-[#323a44] transition-all group"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{getContentTypeIcon(detection.type)}</span>
          <div className="text-left">
            <div className="text-[#b6c2cf] font-semibold flex items-center gap-2">
              Smart Insights
              <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                {getContentTypeName(detection.type)}
              </span>
            </div>
            <div className="text-xs text-[#9fadbc]">
              {detection.confidence}% confident • Click to {expanded ? 'collapse' : 'expand'}
            </div>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[#9fadbc] transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="mt-3 p-4 bg-[#22272b] rounded-lg">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-3 text-[#9fadbc]">
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Fetching data...
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-4">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button
                onClick={handleEnrich}
                className="text-accent text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          )}

          {enrichedData && (
            <>
              {/* Ratings Section */}
              {enrichedData.ratings && enrichedData.ratings.length > 0 && (
                <RatingsSection ratings={enrichedData.ratings} />
              )}

              {/* Content-specific sections */}
              {isEntertainmentData(enrichedData) && (
                <EntertainmentSection data={enrichedData} />
              )}

              {isBookData(enrichedData) && (
                <BookSection data={enrichedData} />
              )}

              {isGameData(enrichedData) && (
                <GameSection data={enrichedData} />
              )}

              {/* Links Section */}
              {enrichedData.links && enrichedData.links.length > 0 && (
                <LinksSection links={enrichedData.links} />
              )}

              {/* Related Content */}
              {enrichedData.related && enrichedData.related.length > 0 && (
                <RelatedSection related={enrichedData.related} />
              )}
            </>
          )}

          {!loading && !error && !enrichedData && (
            <div className="text-center py-4 text-[#9fadbc] text-sm">
              No additional data available
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Type guards
function isEntertainmentData(data: EnrichedData): data is EntertainmentData {
  return data !== null && ['tv_series', 'movie', 'anime'].includes(data.type);
}

function isBookData(data: EnrichedData): data is BookData {
  return data !== null && data.type === 'book';
}

function isGameData(data: EnrichedData): data is GameData {
  return data !== null && data.type === 'game';
}

// Sub-components
const RatingsSection: React.FC<{ ratings: ContentRating[] }> = ({ ratings }) => (
  <div className="mb-4">
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Ratings</h4>
    <div className="flex flex-wrap gap-2">
      {ratings.map((rating, idx) => (
        <a
          key={idx}
          href={rating.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-[#1a1f26] rounded-lg hover:bg-[#2a3038] transition-all"
        >
          <span>{rating.icon || '⭐'}</span>
          <div>
            <div className="text-white font-semibold text-sm">
              {typeof rating.score === 'number'
                ? `${rating.score}${rating.maxScore ? `/${rating.maxScore}` : ''}`
                : rating.score}
            </div>
            <div className="text-[#9fadbc] text-xs">{rating.source}</div>
          </div>
        </a>
      ))}
    </div>
  </div>
);

const EntertainmentSection: React.FC<{ data: EntertainmentData }> = ({ data }) => (
  <div className="mb-4">
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">
      {data.type === 'tv_series' ? 'Show Info' : data.type === 'anime' ? 'Anime Info' : 'Movie Info'}
    </h4>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {data.yearRange && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Years:</span>
          <span className="text-white">{data.yearRange}</span>
        </div>
      )}
      {data.year && !data.yearRange && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Year:</span>
          <span className="text-white">{data.year}</span>
        </div>
      )}
      {data.seasons && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Seasons:</span>
          <span className="text-white">{data.seasons}</span>
        </div>
      )}
      {data.episodes && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Episodes:</span>
          <span className="text-white">{data.episodes}</span>
        </div>
      )}
      {data.runtime && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Runtime:</span>
          <span className="text-white">{data.runtime}</span>
        </div>
      )}
      {data.status && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Status:</span>
          <span className={`${data.status === 'ended' ? 'text-green-400' : 'text-yellow-400'}`}>
            {data.status === 'ended' ? 'Ended' : data.status === 'ongoing' ? 'Ongoing' : 'Upcoming'}
          </span>
        </div>
      )}
    </div>

    {/* Genres */}
    {data.genres && data.genres.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1">
        {data.genres.map((genre, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-[#3d444d] text-[#9fadbc] text-xs rounded"
          >
            {genre}
          </span>
        ))}
      </div>
    )}

    {/* Streaming */}
    {data.streaming && data.streaming.length > 0 && (
      <div className="mt-4">
        <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Where to Watch</h4>
        <div className="flex flex-wrap gap-2">
          {data.streaming.map((service, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1f26] rounded-lg text-sm"
            >
              <span className="text-white">{service.service}</span>
              <span className={`text-xs ${service.type === 'subscription' ? 'text-green-400' : 'text-yellow-400'}`}>
                {service.type === 'subscription' ? 'Included' : service.price || 'Rent/Buy'}
              </span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Franchise Info */}
    {data.franchise && (
      <div className="mt-4">
        <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">
          Part of: {data.franchise.name}
        </h4>
        {data.franchise.items && (
          <div className="space-y-1">
            {data.franchise.items.map((item, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-2 text-sm ${
                  data.franchise?.position === idx + 1 ? 'text-accent font-medium' : 'text-[#9fadbc]'
                }`}
              >
                <span>{idx + 1}.</span>
                <span>{item.title}</span>
                {item.year && <span className="text-xs">({item.year})</span>}
                {data.franchise?.position === idx + 1 && (
                  <span className="text-xs bg-accent/20 px-1.5 py-0.5 rounded">Current</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
  </div>
);

const BookSection: React.FC<{ data: BookData }> = ({ data }) => (
  <div className="mb-4">
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Book Info</h4>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {data.author && (
        <div className="flex items-center gap-2 col-span-2">
          <span className="text-[#9fadbc]">Author:</span>
          <span className="text-white">{data.author}</span>
        </div>
      )}
      {data.year && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Published:</span>
          <span className="text-white">{data.year}</span>
        </div>
      )}
      {data.pages && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Pages:</span>
          <span className="text-white">{data.pages}</span>
        </div>
      )}
      {data.isbn && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">ISBN:</span>
          <span className="text-white font-mono text-xs">{data.isbn}</span>
        </div>
      )}
    </div>

    {/* Genres */}
    {data.genres && data.genres.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1">
        {data.genres.map((genre, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-[#3d444d] text-[#9fadbc] text-xs rounded"
          >
            {genre}
          </span>
        ))}
      </div>
    )}

    {/* Series Info */}
    {data.series && (
      <div className="mt-3 p-2 bg-[#1a1f26] rounded-lg text-sm">
        <span className="text-[#9fadbc]">Part of:</span>{' '}
        <span className="text-white">{data.series.name}</span>
        {data.series.position && data.series.total && (
          <span className="text-accent ml-2">
            (Book {data.series.position} of {data.series.total})
          </span>
        )}
      </div>
    )}
  </div>
);

const GameSection: React.FC<{ data: GameData }> = ({ data }) => (
  <div className="mb-4">
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Game Info</h4>
    <div className="grid grid-cols-2 gap-2 text-sm">
      {data.year && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Released:</span>
          <span className="text-white">{data.year}</span>
        </div>
      )}
      {data.developer && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Developer:</span>
          <span className="text-white">{data.developer}</span>
        </div>
      )}
      {data.playtime && (
        <div className="flex items-center gap-2">
          <span className="text-[#9fadbc]">Playtime:</span>
          <span className="text-white">{data.playtime}</span>
        </div>
      )}
    </div>

    {/* Platforms */}
    {data.platforms && data.platforms.length > 0 && (
      <div className="mt-3">
        <span className="text-[#9fadbc] text-xs">Platforms: </span>
        <div className="inline-flex flex-wrap gap-1 mt-1">
          {data.platforms.map((platform, idx) => (
            <span
              key={idx}
              className="px-2 py-0.5 bg-[#3d444d] text-white text-xs rounded"
            >
              {platform}
            </span>
          ))}
        </div>
      </div>
    )}

    {/* Genres */}
    {data.genres && data.genres.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-1">
        {data.genres.map((genre, idx) => (
          <span
            key={idx}
            className="px-2 py-0.5 bg-[#3d444d] text-[#9fadbc] text-xs rounded"
          >
            {genre}
          </span>
        ))}
      </div>
    )}
  </div>
);

const LinksSection: React.FC<{ links: { name: string; url: string; icon?: string }[] }> = ({ links }) => (
  <div className="mb-4">
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Quick Links</h4>
    <div className="flex flex-wrap gap-2">
      {links.map((link, idx) => (
        <a
          key={idx}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1a1f26] hover:bg-[#2a3038]
                     rounded-lg text-sm text-white transition-all"
        >
          {link.icon && <span>{link.icon}</span>}
          {link.name}
          <svg className="w-3 h-3 text-[#9fadbc]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      ))}
    </div>
  </div>
);

const RelatedSection: React.FC<{ related: { type: string; title: string; year?: string; url?: string }[] }> = ({ related }) => (
  <div>
    <h4 className="text-[#9fadbc] text-xs uppercase tracking-wide mb-2">Related</h4>
    <div className="space-y-1">
      {related.map((item, idx) => (
        <a
          key={idx}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-[#9fadbc] hover:text-white transition-all"
        >
          <span className="text-xs text-[#6b7280]">→</span>
          <span>{item.title}</span>
          {item.year && <span className="text-xs">({item.year})</span>}
          <span className="text-xs text-[#6b7280] capitalize">• {item.type.replace('_', ' ')}</span>
        </a>
      ))}
    </div>
  </div>
);

export default SmartInsights;
