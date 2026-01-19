// Book New Content Detection Strategy
// Checks for new books in a series or by the same author

import { ContentType, BookData } from '../../types';
import {
  NewContentStrategy,
  NewContentDetectionContext,
  NewContentDetectionResult,
} from '../NewContentDetector';

export class BookStrategy implements NewContentStrategy {
  readonly supportedTypes: ContentType[] = ['book'];

  detect(context: NewContentDetectionContext): NewContentDetectionResult {
    const { enrichedData } = context;

    // Must have book data
    if (!enrichedData || enrichedData.type !== 'book') {
      return { hasNewContent: false };
    }

    const bookData = enrichedData as BookData;

    // Check for series-based new content
    const seriesResult = this.checkSeries(bookData);
    if (seriesResult.hasNewContent) {
      return seriesResult;
    }

    // Check related books (sequels, by same author)
    const relatedResult = this.checkRelated(bookData);
    if (relatedResult.hasNewContent) {
      return relatedResult;
    }

    return {
      hasNewContent: false,
      debug: { reason: 'No new books found in series or by author' },
    };
  }

  private checkSeries(bookData: BookData): NewContentDetectionResult {
    if (!bookData.series) {
      return { hasNewContent: false };
    }

    const { position, total } = bookData.series;

    // If position is known and there are more books after it
    if (position && total && position < total) {
      return {
        hasNewContent: true,
        upcomingContent: {
          contentKind: 'book',
          title: `Book ${position + 1} in ${bookData.series.name}`,
          source: 'openlibrary',
          seriesPosition: position + 1,
        },
        debug: {
          reason: 'More books in series',
          comparison: `Position ${position} of ${total} in "${bookData.series.name}"`,
        },
      };
    }

    return { hasNewContent: false };
  }

  private checkRelated(bookData: BookData): NewContentDetectionResult {
    if (!bookData.related || bookData.related.length === 0) {
      return { hasNewContent: false };
    }

    // Look for sequel or by-same-creator content
    const sequel = bookData.related.find(
      (r) => r.type === 'sequel' || r.type === 'series'
    );

    if (sequel) {
      return {
        hasNewContent: true,
        upcomingContent: {
          contentKind: 'book',
          title: sequel.title,
          releaseDate: sequel.year ? `${sequel.year}-01-01` : undefined,
          source: 'openlibrary',
        },
        debug: {
          reason: 'Sequel found',
          comparison: sequel.title,
        },
      };
    }

    // Check for new book by same author
    const byAuthor = bookData.related.find((r) => r.type === 'by_same_creator');
    if (byAuthor) {
      const releaseYear = parseInt(byAuthor.year || '0', 10);
      const bookYear = parseInt(bookData.year || '0', 10);

      // Only count as "new" if it's from a recent year
      if (releaseYear > bookYear) {
        return {
          hasNewContent: true,
          upcomingContent: {
            contentKind: 'related',
            title: byAuthor.title,
            description: `New book by ${bookData.author}`,
            releaseDate: byAuthor.year ? `${byAuthor.year}-01-01` : undefined,
            source: 'openlibrary',
          },
          debug: {
            reason: 'New book by same author',
            comparison: `${byAuthor.title} (${byAuthor.year})`,
          },
        };
      }
    }

    return { hasNewContent: false };
  }
}
