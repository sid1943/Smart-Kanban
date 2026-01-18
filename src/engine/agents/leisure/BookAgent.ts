// Book Agent - Handles detection and enrichment for books
// APIs: Open Library

import { BaseAgent, AgentDetectionResult, DetectionContext } from '../BaseAgent';
import { EnrichedData, BookData } from '../../types';
import { enrichFromOpenLibrary, getBooksByAuthor } from '../../enrichment/openLibrary';

export class BookAgent extends BaseAgent {
  readonly type = 'book' as const;
  readonly name = 'Book Agent';
  readonly category = 'leisure' as const;
  readonly apis = ['Open Library'];

  // Strong signals for books
  protected keywords = [
    /\b(book|novel|novella|memoir|autobiography|biography)\b/i,
    /\b(audiobook|ebook|e-book|kindle|hardcover|paperback)\b/i,
    /\b(chapter|chapters|pages?|pg)\s*\d*/i,
    /\bisbn\b/i,
    /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+/,  // "by Author Name" pattern
  ];

  // Weak/context signals
  protected contextKeywords = [
    /\b(read|reading|reader|bookworm)\b/i,
    /\b(library|bookstore|goodreads)\b/i,
    /\b(fiction|non-?fiction|literature)\b/i,
    /\b(bestseller|classic|anthology)\b/i,
    /\b(author|writer|novelist|publisher)\b/i,
    /\b(series|volume|vol\.?|book\s*\d+)\b/i,
  ];

  // URL patterns that indicate books
  protected urlPatterns = [
    { pattern: /goodreads\.com\/book\/show\/\d+/i, weight: 60 },
    { pattern: /openlibrary\.org/i, weight: 50 },
    { pattern: /amazon\.com.*\/dp\/[A-Z0-9]+/i, weight: 30 },
    { pattern: /audible\.com/i, weight: 40 },
    { pattern: /librarything\.com/i, weight: 50 },
  ];

  // List context mappings
  protected getListContextMappings(): [string, number][] {
    return [
      ['books', 35],
      ['reading', 30],
      ['to_read', 30],
      ['read', 25],
      ['library', 20],
      ['bookshelf', 25],
      ['currently_reading', 35],
    ];
  }

  // Additional book-specific detection
  canHandle(context: DetectionContext): AgentDetectionResult {
    const result = super.canHandle(context);

    // Check for author pattern "by Author Name"
    const authorMatch = context.title.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (authorMatch) {
      result.confidence = Math.min(100, result.confidence + 30);
      result.signals.push(`Author detected: ${authorMatch[1]}`);
      result.metadata.author = authorMatch[1];
    }

    // Check description for book-related terms
    if (context.description) {
      const bookTerms = (context.description.match(/\b(chapter|pages?|isbn|publish|edition)\b/gi) || []).length;
      if (bookTerms >= 2) {
        result.confidence = Math.min(100, result.confidence + 20);
        result.signals.push('Multiple book terms in description');
      }
    }

    // Page count in text (e.g., "352 pages")
    const pageMatch = context.description?.match(/\b(\d{2,4})\s*pages?\b/i);
    if (pageMatch) {
      result.confidence = Math.min(100, result.confidence + 15);
      result.signals.push(`Page count: ${pageMatch[1]}`);
    }

    return result;
  }

  // Extract author from "Title by Author" format
  protected extractMetadata(text: string, context: DetectionContext) {
    const metadata = super.extractMetadata(text, context);

    const authorMatch = text.match(/by\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
    if (authorMatch) {
      metadata.author = authorMatch[1];
    }

    return metadata;
  }

  // Fetch enriched data for books
  async enrich(title: string, year?: string): Promise<EnrichedData> {
    console.log(`[BookAgent] Enriching: ${title}`);

    // Extract author if present in title
    let searchTitle = title;
    let author: string | undefined;

    const authorMatch = title.match(/(.+?)\s+by\s+(.+)/i);
    if (authorMatch) {
      searchTitle = authorMatch[1].trim();
      author = authorMatch[2].trim();
    }

    const bookData = await enrichFromOpenLibrary(searchTitle, author);
    if (!bookData) {
      console.log(`[BookAgent] No Open Library data found for: ${title}`);
      return null;
    }

    // Get related books by same author
    if (bookData.author) {
      const related = await getBooksByAuthor(bookData.author, bookData.title);
      if (related.length > 0) {
        bookData.related = related;
      }
    }

    const enrichedData: BookData = {
      ...bookData,
      title: bookData.title || searchTitle, // Ensure title is always set
      type: 'book',
      ratings: bookData.ratings || [], // Ensure ratings is always an array
      links: bookData.links || [], // Ensure links is always an array
    };

    console.log(`[BookAgent] Enriched: ${title}`);
    return enrichedData;
  }
}

export default BookAgent;
