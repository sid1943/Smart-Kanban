// Content Type Picker - Allows users to manually set or confirm content type
import React from 'react';
import { getContentTypeIcon, getContentTypeName } from '../engine';

type ContentType = 'tv_series' | 'movie' | 'anime' | 'book' | 'game' | 'music' | 'unknown';

interface ContentTypePickerProps {
  currentType?: ContentType;
  suggestedTypes?: { type: ContentType; confidence: number }[];
  onSelect: (type: ContentType) => void;
  onDismiss?: () => void;
  compact?: boolean;
}

const ALL_TYPES: ContentType[] = ['tv_series', 'movie', 'anime', 'book', 'game', 'music'];

export const ContentTypePicker: React.FC<ContentTypePickerProps> = ({
  currentType,
  suggestedTypes = [],
  onSelect,
  onDismiss,
  compact = false,
}) => {
  // Get suggested types or show all
  const typesToShow = suggestedTypes.length > 0
    ? suggestedTypes.map(s => s.type)
    : ALL_TYPES;

  // Add any missing types to the end
  const allTypesToShow = [
    ...typesToShow,
    ...ALL_TYPES.filter(t => !typesToShow.includes(t)),
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {allTypesToShow.map((type) => (
          <button
            key={type}
            onClick={() => onSelect(type)}
            className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-all ${
              currentType === type
                ? 'bg-accent text-white'
                : 'bg-[#3d444d] text-[#9fadbc] hover:bg-[#4d545d] hover:text-white'
            }`}
          >
            <span>{getContentTypeIcon(type)}</span>
            <span>{getContentTypeName(type)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 bg-[#22272b] rounded-lg border border-[#3d444d]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="text-white font-medium">What type of content is this?</h4>
          <p className="text-[#9fadbc] text-xs mt-0.5">
            Help us show you better insights by selecting the content type
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-[#9fadbc] hover:text-white p-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Suggested types (if any) */}
      {suggestedTypes.length > 0 && (
        <div className="mb-3">
          <p className="text-[#6b7280] text-xs uppercase tracking-wide mb-2">Suggestions</p>
          <div className="flex flex-wrap gap-2">
            {suggestedTypes.map(({ type, confidence }) => (
              <button
                key={type}
                onClick={() => onSelect(type)}
                className={`px-3 py-2 rounded-lg flex items-center gap-2 transition-all ${
                  currentType === type
                    ? 'bg-accent text-white ring-2 ring-accent/50'
                    : 'bg-[#3d444d] text-white hover:bg-[#4d545d]'
                }`}
              >
                <span className="text-lg">{getContentTypeIcon(type)}</span>
                <div className="text-left">
                  <div className="text-sm font-medium">{getContentTypeName(type)}</div>
                  <div className="text-xs opacity-60">{confidence}% match</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* All types */}
      <div>
        <p className="text-[#6b7280] text-xs uppercase tracking-wide mb-2">
          {suggestedTypes.length > 0 ? 'All Types' : 'Select Type'}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {ALL_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className={`px-3 py-2 rounded flex items-center gap-2 transition-all ${
                currentType === type
                  ? 'bg-accent text-white'
                  : 'bg-[#1a1f26] text-[#9fadbc] hover:bg-[#3d444d] hover:text-white'
              }`}
            >
              <span>{getContentTypeIcon(type)}</span>
              <span className="text-sm">{getContentTypeName(type)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Skip option */}
      <button
        onClick={() => onSelect('unknown')}
        className="mt-3 w-full text-center text-[#9fadbc] text-xs hover:text-white py-2"
      >
        Skip - Not media content
      </button>
    </div>
  );
};

export default ContentTypePicker;
