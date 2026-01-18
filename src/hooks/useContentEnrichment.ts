// Hook for content enrichment - fetches data on mount
import { useState, useEffect } from 'react';
import { detect, enrich, EnrichedData, DetectionResult } from '../engine';

interface UseContentEnrichmentProps {
  title: string;
  description?: string;
  listContext?: string;
  urls?: string[];
  checklistNames?: string[];
}

interface UseContentEnrichmentResult {
  detection: DetectionResult | null;
  data: EnrichedData;
  loading: boolean;
  error: string | null;
}

export function useContentEnrichment({
  title,
  description,
  listContext,
  urls,
  checklistNames,
}: UseContentEnrichmentProps): UseContentEnrichmentResult {
  const [detection, setDetection] = useState<DetectionResult | null>(null);
  const [data, setData] = useState<EnrichedData>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Detect content type
    const checklistText = checklistNames?.join(' ') || '';
    const allText = `${title} ${description || ''} ${listContext || ''} ${checklistText}`;
    const result = detect(allText, listContext, urls);
    setDetection(result);

    // Only fetch if confidence is reasonable and type is known
    if (result.type !== 'unknown' && result.confidence >= 25) {
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
      enrich(cleanedTitle, result.type, listContext, urls, year)
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
  }, [title, description, listContext, urls, checklistNames]);

  return { detection, data, loading, error };
}
