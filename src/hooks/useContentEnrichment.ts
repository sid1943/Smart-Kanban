// Hook for content enrichment - fetches data on mount
import { useState, useEffect } from 'react';
import { detect, enrich, EnrichedData, DetectionResult, ContentType } from '../engine';

interface UseContentEnrichmentProps {
  title: string;
  description?: string;
  listContext?: string;
  urls?: string[];
  checklistNames?: string[];
  // If content type was already set (stored or manual), use it directly
  storedContentType?: ContentType;
  storedContentTypeManual?: boolean;
}

interface UseContentEnrichmentResult {
  detection: DetectionResult | null;
  data: EnrichedData;
  loading: boolean;
  error: string | null;
  // For prompting user to categorize
  needsUserInput: boolean;
  suggestedTypes: { type: ContentType; confidence: number }[];
}

export function useContentEnrichment({
  title,
  description,
  listContext,
  urls,
  checklistNames,
  storedContentType,
  storedContentTypeManual,
}: UseContentEnrichmentProps): UseContentEnrichmentResult {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [data, setData] = useState<EnrichedData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsUserInput, setNeedsUserInput] = useState(false);
  const [suggestedTypes, setSuggestedTypes] = useState<{ type: ContentType; confidence: number }[]>([]);

  useEffect(() => {
    // If user manually set type, use it directly without detection
    if (storedContentType && storedContentTypeManual) {
      setDetection({
        type: storedContentType,
        category: ['tv_series', 'movie', 'anime'].includes(storedContentType) ? 'entertainment' : 'leisure',
        confidence: 100,
        signals: ['User specified'],
        metadata: { title },
      });
      setNeedsUserInput(false);
      fetchEnrichment(storedContentType);
      return;
    }

    // Detect content type
    const checklistText = checklistNames?.join(' ') || '';
    const allText = `${title} ${description || ''} ${listContext || ''} ${checklistText}`;
    const result = detect(allText, listContext, urls);
    setDetection(result);

    // Check if we need user input (low confidence or unknown)
    if (result.type === 'unknown' || result.confidence < 40) {
      setNeedsUserInput(true);
      // Suggest possible types based on any signals we found
      const suggestions = getSuggestedTypes(result, allText);
      setSuggestedTypes(suggestions);

      // If we have a stored type (from previous detection), still use it
      if (storedContentType && storedContentType !== 'unknown') {
        fetchEnrichment(storedContentType);
      }
      return;
    }

    setNeedsUserInput(false);
    fetchEnrichment(result.type);
  }, [title, description, listContext, urls, checklistNames, storedContentType, storedContentTypeManual]);

  function fetchEnrichment(type: ContentType) {
    if (type === 'unknown') return;

    setLoading(true);
    setError(null);

    // Clean the card title directly - remove year patterns like (2015-2019) or (2015)
    const cleanedTitle = title
      .replace(/\s*\(\s*(19|20)\d{2}\s*[-–—]?\s*((19|20)?\d{2,4}|present)?\s*\)/gi, '')
      .replace(/\s*[-–—]\s*(19|20)\d{2}.*$/g, '')
      .trim();

    // Extract year from title for better search accuracy
    const yearMatch = title.match(/\(?(19|20)\d{2}/);
    const year = yearMatch ? yearMatch[0].replace('(', '') : undefined;

    // Pass year to help find the correct version (e.g., Twilight Zone 1959 vs 2002)
    enrich(cleanedTitle, type, listContext, urls, year)
      .then((enrichResult) => {
        if (enrichResult.success && enrichResult.data) {
          setData(enrichResult.data);
        } else {
          setError(enrichResult.error || 'Failed to fetch data');
        }
      })
      .catch(() => {
        setError('Failed to fetch data');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  return { detection, data, loading, error, needsUserInput, suggestedTypes };
}

// Helper to suggest content types when detection is uncertain
function getSuggestedTypes(
  result: DetectionResult,
  text: string
): { type: ContentType; confidence: number }[] {
  const suggestions: { type: ContentType; confidence: number }[] = [];
  const lowerText = text.toLowerCase();

  // Check for entertainment signals
  if (lowerText.match(/season|episode|series|watch|netflix|hbo|streaming/)) {
    suggestions.push({ type: 'tv_series', confidence: 30 });
  }
  if (lowerText.match(/movie|film|cinema|theater/)) {
    suggestions.push({ type: 'movie', confidence: 30 });
  }
  if (lowerText.match(/anime|manga|crunchyroll|sub|dub/)) {
    suggestions.push({ type: 'anime', confidence: 30 });
  }
  if (lowerText.match(/book|read|author|novel|pages/)) {
    suggestions.push({ type: 'book', confidence: 30 });
  }
  if (lowerText.match(/game|play|steam|xbox|playstation|nintendo/)) {
    suggestions.push({ type: 'game', confidence: 30 });
  }
  if (lowerText.match(/album|song|music|spotify|artist/)) {
    suggestions.push({ type: 'music', confidence: 30 });
  }

  // If we have a detected type with some confidence, boost it
  if (result.type !== 'unknown' && result.confidence > 0) {
    const existing = suggestions.find(s => s.type === result.type);
    if (existing) {
      existing.confidence = Math.min(100, existing.confidence + result.confidence);
    } else {
      suggestions.push({ type: result.type, confidence: result.confidence });
    }
  }

  // Sort by confidence and return top suggestions
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

// Export a function to run detection on a task (for import flow)
export function detectContentType(
  title: string,
  description?: string,
  listContext?: string,
  urls?: string[],
  checklistNames?: string[]
): { type: ContentType; confidence: number; needsUserInput: boolean } {
  const checklistText = checklistNames?.join(' ') || '';
  const allText = `${title} ${description || ''} ${listContext || ''} ${checklistText}`;
  const result = detect(allText, listContext, urls);

  return {
    type: result.type,
    confidence: result.confidence,
    needsUserInput: result.type === 'unknown' || result.confidence < 40,
  };
}
