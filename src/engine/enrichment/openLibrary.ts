// Open Library API Client - Books
// Free API: https://openlibrary.org/developers/api (No API key required)

import { BookData, ContentRating, RelatedContent } from '../types';

const OPEN_LIBRARY_BASE = 'https://openlibrary.org';

interface OpenLibraryWork {
  key: string;
  title: string;
  authors?: { author: { key: string } }[];
  covers?: number[];
  description?: string | { value: string };
  subjects?: string[];
  first_publish_date?: string;
}

interface OpenLibraryAuthor {
  name: string;
  bio?: string | { value: string };
  photos?: number[];
}

interface OpenLibrarySearchDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  isbn?: string[];
  number_of_pages_median?: number;
  subject?: string[];
  edition_count?: number;
  ratings_average?: number;
  ratings_count?: number;
}

interface OpenLibrarySearchResult {
  numFound: number;
  docs: OpenLibrarySearchDoc[];
}

export async function searchOpenLibrary(
  query: string,
  author?: string
): Promise<OpenLibrarySearchDoc | null> {
  try {
    const searchQuery = author ? `${query} ${author}` : query;
    const params = new URLSearchParams({
      q: searchQuery,
      limit: '1',
      fields: 'key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median,subject,edition_count,ratings_average,ratings_count',
    });

    const response = await fetch(`${OPEN_LIBRARY_BASE}/search.json?${params}`);
    if (!response.ok) return null;

    const data: OpenLibrarySearchResult = await response.json();
    return data.docs?.[0] || null;
  } catch (error) {
    console.error('Open Library search error:', error);
    return null;
  }
}

export async function getOpenLibraryWork(workKey: string): Promise<OpenLibraryWork | null> {
  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE}${workKey}.json`);
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('Open Library work fetch error:', error);
    return null;
  }
}

export async function getOpenLibraryAuthor(authorKey: string): Promise<OpenLibraryAuthor | null> {
  try {
    const response = await fetch(`${OPEN_LIBRARY_BASE}${authorKey}.json`);
    if (!response.ok) return null;

    return await response.json();
  } catch (error) {
    console.error('Open Library author fetch error:', error);
    return null;
  }
}

// Generate Goodreads search URL (no direct API access)
function getGoodreadsSearchUrl(title: string, author?: string): string {
  const query = author ? `${title} ${author}` : title;
  return `https://www.goodreads.com/search?q=${encodeURIComponent(query)}`;
}

// Generate Amazon search URL
function getAmazonSearchUrl(title: string, author?: string): string {
  const query = author ? `${title} ${author}` : title;
  return `https://www.amazon.com/s?k=${encodeURIComponent(query)}&i=stripbooks`;
}

export async function enrichFromOpenLibrary(
  title: string,
  author?: string
): Promise<Partial<BookData> | null> {
  const searchResult = await searchOpenLibrary(title, author);
  if (!searchResult) return null;

  // Build ratings
  const ratings: ContentRating[] = [];

  if (searchResult.ratings_average) {
    ratings.push({
      source: 'Open Library',
      score: Math.round(searchResult.ratings_average * 10) / 10,
      maxScore: 5,
      icon: '📖',
      url: `${OPEN_LIBRARY_BASE}${searchResult.key}`,
    });
  }

  // Build links
  const authorName = searchResult.author_name?.[0];
  const links = [
    {
      name: 'Open Library',
      url: `${OPEN_LIBRARY_BASE}${searchResult.key}`,
      icon: '📖',
    },
    {
      name: 'Goodreads',
      url: getGoodreadsSearchUrl(searchResult.title, authorName),
      icon: '📚',
    },
    {
      name: 'Amazon',
      url: getAmazonSearchUrl(searchResult.title, authorName),
      icon: '🛒',
    },
  ];

  // Get cover image
  let cover: string | undefined;
  if (searchResult.cover_i) {
    cover = `https://covers.openlibrary.org/b/id/${searchResult.cover_i}-L.jpg`;
  }

  // Build genres from subjects
  const genres = searchResult.subject?.slice(0, 5).map(s =>
    s.split(' -- ')[0] // Remove subject hierarchies
  );

  return {
    type: 'book',
    title: searchResult.title,
    author: authorName,
    year: searchResult.first_publish_year?.toString(),
    ratings,
    pages: searchResult.number_of_pages_median,
    isbn: searchResult.isbn?.[0],
    genres,
    links,
    cover,
  };
}

// Search for books by same author
export async function getBooksByAuthor(
  authorName: string,
  excludeTitle?: string
): Promise<RelatedContent[]> {
  try {
    const params = new URLSearchParams({
      author: authorName,
      limit: '5',
      fields: 'key,title,first_publish_year',
    });

    const response = await fetch(`${OPEN_LIBRARY_BASE}/search.json?${params}`);
    if (!response.ok) return [];

    const data: OpenLibrarySearchResult = await response.json();

    return data.docs
      .filter(doc => doc.title.toLowerCase() !== excludeTitle?.toLowerCase())
      .slice(0, 4)
      .map(doc => ({
        type: 'by_same_creator' as const,
        title: doc.title,
        year: doc.first_publish_year?.toString(),
        url: `${OPEN_LIBRARY_BASE}${doc.key}`,
      }));
  } catch (error) {
    console.error('Open Library author books error:', error);
    return [];
  }
}
