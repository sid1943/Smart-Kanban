// ConflictResolver - Resolves conflicts when multiple agents claim content
// Uses weighted voting and specificity rules

import { ContentType } from '../../types';
import {
  ConflictClaim,
  ConflictResolvedPayload,
  AgentId,
} from '../messaging/types';

// Resolution method used
export type ResolutionMethod = 'confidence' | 'specificity' | 'signals' | 'voting';

// Resolution result
export interface ResolutionResult {
  winner: ConflictClaim;
  method: ResolutionMethod;
  reason: string;
  votes?: { agentId: AgentId; votedFor: AgentId }[];
}

// Specificity rankings (higher = more specific)
const SPECIFICITY_RANKS: Record<ContentType, number> = {
  anime: 100, // Most specific - anime is a distinct category
  tv_series: 80,
  movie: 75,
  book: 70,
  game: 65,
  music: 60,
  unknown: 0,
};

// Signal quality weights
const SIGNAL_WEIGHTS: Record<string, number> = {
  'URL pattern matched': 50,
  'Year range detected': 30,
  'Season checklist found': 35,
  Keyword: 25,
  Context: 15,
  'List context': 20,
  'User specified': 100,
};

// Confidence threshold for automatic win
const CONFIDENCE_DIFF_THRESHOLD = 15;

// Minimum confidence for a valid claim
const MIN_VALID_CONFIDENCE = 20;

export class ConflictResolver {
  /**
   * Resolve a conflict between multiple claims
   */
  resolve(claims: ConflictClaim[], cardId?: string): ResolutionResult {
    // Filter out low-confidence claims
    const validClaims = claims.filter((c) => c.confidence >= MIN_VALID_CONFIDENCE);

    if (validClaims.length === 0) {
      // No valid claims - return the best of what we have
      const best = this.getHighestConfidence(claims);
      return {
        winner: best,
        method: 'confidence',
        reason: 'No valid claims, using highest confidence',
      };
    }

    if (validClaims.length === 1) {
      return {
        winner: validClaims[0],
        method: 'confidence',
        reason: 'Single valid claim',
      };
    }

    // Sort by confidence
    const sorted = [...validClaims].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0];
    const second = sorted[1];

    // 1. Check confidence difference
    if (top.confidence - second.confidence >= CONFIDENCE_DIFF_THRESHOLD) {
      return {
        winner: top,
        method: 'confidence',
        reason: `Confidence difference of ${top.confidence - second.confidence}% exceeds threshold`,
      };
    }

    // 2. Close confidence - check specificity
    const topSpecificity = SPECIFICITY_RANKS[top.contentType] || 0;
    const secondSpecificity = SPECIFICITY_RANKS[second.contentType] || 0;

    if (topSpecificity !== secondSpecificity) {
      const specificityWinner = topSpecificity > secondSpecificity ? top : second;
      return {
        winner: specificityWinner,
        method: 'specificity',
        reason: `${specificityWinner.contentType} is more specific than alternatives`,
      };
    }

    // 3. Same specificity - check signal quality
    const topSignalScore = this.calculateSignalScore(top);
    const secondSignalScore = this.calculateSignalScore(second);

    if (Math.abs(topSignalScore - secondSignalScore) > 10) {
      const signalWinner = topSignalScore > secondSignalScore ? top : second;
      return {
        winner: signalWinner,
        method: 'signals',
        reason: `Signal quality score ${Math.round(Math.max(topSignalScore, secondSignalScore))} vs ${Math.round(Math.min(topSignalScore, secondSignalScore))}`,
      };
    }

    // 4. Still tied - use voting from all agents
    const votes = this.conductVoting(validClaims);
    const voteWinner = this.getVoteWinner(validClaims, votes);

    return {
      winner: voteWinner,
      method: 'voting',
      reason: 'Resolved by agent voting',
      votes,
    };
  }

  /**
   * Quick resolve - just returns highest confidence
   */
  quickResolve(claims: ConflictClaim[]): ConflictClaim {
    return this.getHighestConfidence(claims);
  }

  /**
   * Check if there's a conflict (multiple high-confidence claims)
   */
  hasConflict(claims: ConflictClaim[]): boolean {
    const validClaims = claims.filter((c) => c.confidence >= MIN_VALID_CONFIDENCE);
    if (validClaims.length < 2) return false;

    // Sort by confidence
    const sorted = [...validClaims].sort((a, b) => b.confidence - a.confidence);
    const diff = sorted[0].confidence - sorted[1].confidence;

    return diff < CONFIDENCE_DIFF_THRESHOLD;
  }

  /**
   * Get conflicting claims (close in confidence)
   */
  getConflictingClaims(claims: ConflictClaim[]): ConflictClaim[] {
    const validClaims = claims.filter((c) => c.confidence >= MIN_VALID_CONFIDENCE);
    if (validClaims.length < 2) return validClaims;

    const sorted = [...validClaims].sort((a, b) => b.confidence - a.confidence);
    const top = sorted[0];

    // Return claims within threshold of top
    return sorted.filter(
      (c) => top.confidence - c.confidence < CONFIDENCE_DIFF_THRESHOLD
    );
  }

  /**
   * Build resolution payload for messaging
   */
  buildResolvedPayload(
    conflictId: string,
    cardId: string,
    result: ResolutionResult
  ): ConflictResolvedPayload {
    return {
      conflictId,
      cardId,
      winner: result.winner,
      method: result.method,
      votes: result.votes,
    };
  }

  // Get highest confidence claim
  private getHighestConfidence(claims: ConflictClaim[]): ConflictClaim {
    return claims.reduce((best, claim) =>
      claim.confidence > best.confidence ? claim : best
    );
  }

  // Calculate signal quality score
  private calculateSignalScore(claim: ConflictClaim): number {
    let score = 0;

    for (const signal of claim.signals) {
      // Match signal type from the beginning of the signal string
      for (const [pattern, weight] of Object.entries(SIGNAL_WEIGHTS)) {
        if (signal.startsWith(pattern)) {
          score += weight;
          break;
        }
      }
    }

    // Bonus for having more metadata
    const metadataCount = Object.values(claim.metadata).filter(Boolean).length;
    score += metadataCount * 5;

    return score;
  }

  // Conduct voting among agents
  private conductVoting(
    claims: ConflictClaim[]
  ): { agentId: AgentId; votedFor: AgentId }[] {
    const votes: { agentId: AgentId; votedFor: AgentId }[] = [];

    // Each agent votes based on their confidence in others
    for (const voter of claims) {
      // Agents vote for others, not themselves
      const candidates = claims.filter((c) => c.agentId !== voter.agentId);
      if (candidates.length === 0) continue;

      // Vote for candidate with best combination of confidence and specificity
      let bestCandidate = candidates[0];
      let bestScore = this.getVotingScore(candidates[0]);

      for (const candidate of candidates.slice(1)) {
        const score = this.getVotingScore(candidate);
        if (score > bestScore) {
          bestScore = score;
          bestCandidate = candidate;
        }
      }

      votes.push({
        agentId: voter.agentId,
        votedFor: bestCandidate.agentId,
      });
    }

    return votes;
  }

  // Calculate voting score for a candidate
  private getVotingScore(claim: ConflictClaim): number {
    const specificity = SPECIFICITY_RANKS[claim.contentType] || 0;
    const signalScore = this.calculateSignalScore(claim);
    return claim.confidence * 0.5 + specificity * 0.3 + signalScore * 0.2;
  }

  // Get winner from votes
  private getVoteWinner(
    claims: ConflictClaim[],
    votes: { agentId: AgentId; votedFor: AgentId }[]
  ): ConflictClaim {
    // Count votes for each agent
    const voteCounts = new Map<AgentId, number>();
    for (const vote of votes) {
      voteCounts.set(vote.votedFor, (voteCounts.get(vote.votedFor) || 0) + 1);
    }

    // Find agent with most votes
    let maxVotes = 0;
    let winnerId: AgentId | null = null;

    for (const [agentId, count] of voteCounts) {
      if (count > maxVotes) {
        maxVotes = count;
        winnerId = agentId;
      }
    }

    // Return the claim for the winning agent
    if (winnerId) {
      const winner = claims.find((c) => c.agentId === winnerId);
      if (winner) return winner;
    }

    // Fallback to highest confidence
    return this.getHighestConfidence(claims);
  }
}

// Singleton instance
let defaultResolver: ConflictResolver | null = null;

export function getConflictResolver(): ConflictResolver {
  if (!defaultResolver) {
    defaultResolver = new ConflictResolver();
  }
  return defaultResolver;
}

export function resetConflictResolver(): void {
  defaultResolver = null;
}

export default ConflictResolver;
