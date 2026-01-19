// ValidationPipeline - Validates enriched data before committing to cache
// Runs schema, quality, and cross-validation checks

import {
  ContentType,
  EnrichedData,
  EntertainmentData,
  BookData,
  GameData,
} from '../../types';
import { ValidationIssue, ValidationResponsePayload, AgentId } from '../messaging/types';

// Validation result
export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  score: number;
  passedValidators: string[];
  failedValidators: string[];
}

// Validator interface
interface Validator {
  name: string;
  validate(data: EnrichedData, contentType: ContentType): ValidationIssue[];
}

// Required fields by content type
const REQUIRED_FIELDS: Record<ContentType, string[]> = {
  tv_series: ['title', 'type', 'ratings', 'links'],
  movie: ['title', 'type', 'ratings', 'links'],
  anime: ['title', 'type', 'ratings', 'links'],
  book: ['title', 'type', 'ratings', 'links'],
  game: ['title', 'type', 'ratings', 'links'],
  music: ['title', 'type', 'ratings', 'links'],
  unknown: ['title'],
};

// Quality score weights
const QUALITY_WEIGHTS = {
  hasRatings: 25,
  hasImage: 20,
  hasLinks: 15,
  hasYear: 10,
  hasGenres: 10,
  hasDescription: 10,
  hasRelated: 10,
};

// Schema Validator
const schemaValidator: Validator = {
  name: 'schema',
  validate(data: EnrichedData, contentType: ContentType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!data) {
      issues.push({
        field: 'data',
        severity: 'error',
        message: 'Data is null or undefined',
      });
      return issues;
    }

    // Check required fields
    const requiredFields = REQUIRED_FIELDS[contentType] || REQUIRED_FIELDS.unknown;
    for (const field of requiredFields) {
      const value = (data as unknown as Record<string, unknown>)[field];
      if (value === undefined || value === null) {
        issues.push({
          field,
          severity: 'error',
          message: `Required field "${field}" is missing`,
        });
      } else if (field === 'ratings' && Array.isArray(value) && value.length === 0) {
        issues.push({
          field,
          severity: 'warning',
          message: 'Ratings array is empty',
          suggestion: 'Consider fetching ratings from additional sources',
        });
      } else if (field === 'links' && Array.isArray(value) && value.length === 0) {
        issues.push({
          field,
          severity: 'warning',
          message: 'Links array is empty',
          suggestion: 'Consider adding IMDB or other reference links',
        });
      }
    }

    // Check type matches expected
    if (data.type !== contentType && contentType !== 'unknown') {
      issues.push({
        field: 'type',
        severity: 'warning',
        message: `Data type "${data.type}" does not match expected "${contentType}"`,
      });
    }

    return issues;
  },
};

// Quality Validator
const qualityValidator: Validator = {
  name: 'quality',
  validate(data: EnrichedData, _contentType: ContentType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!data) return issues;

    // Check ratings quality
    if (data.ratings && data.ratings.length > 0) {
      const validRatings = data.ratings.filter(
        (r) => r.score !== undefined && r.score !== null
      );
      if (validRatings.length === 0) {
        issues.push({
          field: 'ratings',
          severity: 'warning',
          message: 'All ratings are missing score values',
        });
      }
    }

    // Check for image
    const hasImage =
      'poster' in data
        ? !!(data as EntertainmentData).poster
        : 'cover' in data
        ? !!(data as BookData | GameData).cover
        : false;

    if (!hasImage) {
      issues.push({
        field: 'image',
        severity: 'info',
        message: 'No poster/cover image available',
        suggestion: 'Data will still be usable without an image',
      });
    }

    // Check title length
    if (data.title && data.title.length < 2) {
      issues.push({
        field: 'title',
        severity: 'warning',
        message: 'Title seems unusually short',
      });
    }

    if (data.title && data.title.length > 200) {
      issues.push({
        field: 'title',
        severity: 'warning',
        message: 'Title is unusually long',
      });
    }

    // Check year validity
    const year =
      'year' in data ? (data as { year?: string }).year : undefined;
    if (year) {
      const yearNum = parseInt(year, 10);
      const currentYear = new Date().getFullYear();
      if (yearNum < 1800 || yearNum > currentYear + 5) {
        issues.push({
          field: 'year',
          severity: 'warning',
          message: `Year "${year}" seems invalid`,
        });
      }
    }

    return issues;
  },
};

// Cross-validation Validator
const crossValidator: Validator = {
  name: 'cross',
  validate(data: EnrichedData, contentType: ContentType): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (!data) return issues;

    // Check content-type specific requirements
    if (contentType === 'tv_series' || contentType === 'anime') {
      const tvData = data as EntertainmentData;
      if (!tvData.seasons && !tvData.episodes) {
        issues.push({
          field: 'seasons/episodes',
          severity: 'info',
          message: 'No season/episode information available',
        });
      }
    }

    if (contentType === 'movie') {
      const movieData = data as EntertainmentData;
      if (!movieData.runtime) {
        issues.push({
          field: 'runtime',
          severity: 'info',
          message: 'No runtime information available',
        });
      }
    }

    if (contentType === 'book') {
      const bookData = data as BookData;
      if (!bookData.author) {
        issues.push({
          field: 'author',
          severity: 'warning',
          message: 'No author information available',
          suggestion: 'Consider fetching from Open Library or Google Books',
        });
      }
    }

    if (contentType === 'game') {
      const gameData = data as GameData;
      if (!gameData.platforms || gameData.platforms.length === 0) {
        issues.push({
          field: 'platforms',
          severity: 'info',
          message: 'No platform information available',
        });
      }
    }

    // Check for duplicate ratings sources
    if (data.ratings && data.ratings.length > 1) {
      const sources = new Set<string>();
      for (const rating of data.ratings) {
        if (sources.has(rating.source)) {
          issues.push({
            field: 'ratings',
            severity: 'warning',
            message: `Duplicate rating source: ${rating.source}`,
          });
        }
        sources.add(rating.source);
      }
    }

    return issues;
  },
};

export class ValidationPipeline {
  private validators: Validator[] = [];

  constructor() {
    // Register default validators
    this.validators = [schemaValidator, qualityValidator, crossValidator];
  }

  /**
   * Register a custom validator
   */
  registerValidator(validator: Validator): void {
    this.validators.push(validator);
  }

  /**
   * Run all validators on data
   */
  validate(data: EnrichedData, contentType: ContentType): ValidationResult {
    const allIssues: ValidationIssue[] = [];
    const passedValidators: string[] = [];
    const failedValidators: string[] = [];

    for (const validator of this.validators) {
      const issues = validator.validate(data, contentType);
      allIssues.push(...issues);

      const hasErrors = issues.some((i) => i.severity === 'error');
      if (hasErrors) {
        failedValidators.push(validator.name);
      } else {
        passedValidators.push(validator.name);
      }
    }

    // Calculate quality score
    const score = this.calculateQualityScore(data);

    // Determine overall validity (no errors)
    const valid = !allIssues.some((i) => i.severity === 'error');

    return {
      valid,
      issues: allIssues,
      score,
      passedValidators,
      failedValidators,
    };
  }

  /**
   * Quick validation - only check for critical errors
   */
  quickValidate(data: EnrichedData, contentType: ContentType): boolean {
    const schemaIssues = schemaValidator.validate(data, contentType);
    return !schemaIssues.some((i) => i.severity === 'error');
  }

  /**
   * Get quality score (0-100)
   */
  getQualityScore(data: EnrichedData): number {
    return this.calculateQualityScore(data);
  }

  /**
   * Build validation response payload
   */
  buildResponsePayload(
    cardId: string,
    result: ValidationResult
  ): ValidationResponsePayload {
    return {
      cardId,
      valid: result.valid,
      issues: result.issues,
      score: result.score,
    };
  }

  // Calculate quality score based on data completeness
  private calculateQualityScore(data: EnrichedData): number {
    if (!data) return 0;

    let score = 0;

    // Has ratings
    if (data.ratings && data.ratings.length > 0) {
      const validRatings = data.ratings.filter(
        (r) => r.score !== undefined && r.score !== null
      );
      if (validRatings.length > 0) {
        score += QUALITY_WEIGHTS.hasRatings;
      }
    }

    // Has image
    const hasImage =
      ('poster' in data && !!(data as EntertainmentData).poster) ||
      ('cover' in data && !!(data as BookData | GameData).cover);
    if (hasImage) {
      score += QUALITY_WEIGHTS.hasImage;
    }

    // Has links
    if (data.links && data.links.length > 0) {
      score += QUALITY_WEIGHTS.hasLinks;
    }

    // Has year
    const hasYear = 'year' in data && !!(data as { year?: string }).year;
    if (hasYear) {
      score += QUALITY_WEIGHTS.hasYear;
    }

    // Has genres
    const hasGenres =
      'genres' in data &&
      Array.isArray((data as { genres?: string[] }).genres) &&
      (data as { genres: string[] }).genres.length > 0;
    if (hasGenres) {
      score += QUALITY_WEIGHTS.hasGenres;
    }

    // Has related content
    const hasRelated =
      'related' in data &&
      Array.isArray((data as { related?: unknown[] }).related) &&
      (data as { related: unknown[] }).related.length > 0;
    if (hasRelated) {
      score += QUALITY_WEIGHTS.hasRelated;
    }

    return Math.min(100, score);
  }
}

// Singleton instance
let defaultPipeline: ValidationPipeline | null = null;

export function getValidationPipeline(): ValidationPipeline {
  if (!defaultPipeline) {
    defaultPipeline = new ValidationPipeline();
  }
  return defaultPipeline;
}

export function resetValidationPipeline(): void {
  defaultPipeline = null;
}

export default ValidationPipeline;
