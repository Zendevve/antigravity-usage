/**
 * Core Types for Antigravity Usage V2
 *
 * Clean, flat data structures following Laws of UX:
 * - Miller's Law: Simple mental model with clear relationships
 * - Jakob's Law: Familiar patterns matching VS Code conventions
 */

// ============================================================================
// Model & Quota Types
// ============================================================================

/**
 * Raw quota data for a single model
 */
export interface ModelQuota {
  /** Unique identifier from API */
  modelId: string;

  /** Human-readable display name (e.g., "Claude Sonnet 4") */
  label: string;

  /** Remaining quota as percentage (0-100) */
  remainingPercent: number;

  /** Whether quota is completely exhausted */
  isExhausted: boolean;

  /** ISO timestamp when quota resets */
  resetTime?: string;

  /** Human-readable time until reset (e.g., "3h 24m") */
  timeUntilReset?: string;
}

/**
 * Computed insights for a model (from historical analysis)
 */
export interface ModelInsights {
  /** Consumption rate in %/hour */
  burnRate: number;

  /** Human-readable burn rate (e.g., "Fast", "Moderate", "Slow") */
  burnRateLabel: string;

  /** Predicted exhaustion timestamp */
  predictedExhaustion?: Date;

  /** Human-readable prediction (e.g., "~3h 24m") */
  predictedExhaustionLabel?: string;

  /** Usage consumed in current session */
  sessionUsage: number;

  /** Is this the actively used model? */
  isActive: boolean;

  /** Is this model pinned by user? */
  isPinned: boolean;

  /** Historical data points for sparkline (last 20) */
  historyData: number[];
}

/**
 * Combined model data with insights
 */
export interface EnrichedModel extends ModelQuota {
  insights: ModelInsights;
}

// ============================================================================
// Credit Types
// ============================================================================

export interface CreditInfo {
  available: number;
  monthly: number;
}

// ============================================================================
// Health Status
// ============================================================================

export type HealthLevel = 'excellent' | 'good' | 'low' | 'critical';

export interface HealthStatus {
  /** Overall health score (0-100) */
  score: number;

  /** Health level category */
  level: HealthLevel;

  /** Human-readable label */
  label: string;
}

// ============================================================================
// Store State
// ============================================================================

/**
 * Complete application state - single source of truth
 *
 * Laws of UX Applied:
 * - Law of Prägnanz: Simplest possible structure
 * - Chunking: Logical groupings (models, credits, health, meta)
 */
export interface QuotaState {
  /** All models with enriched insights */
  models: EnrichedModel[];

  /** Prompt credits info (optional) */
  promptCredits?: CreditInfo;

  /** Flow credits info (optional) */
  flowCredits?: CreditInfo;

  /** Overall system health */
  health: HealthStatus;

  /** Session start timestamp */
  sessionStart: Date;

  /** Last successful update */
  lastUpdate: Date;

  /** Is currently fetching? */
  isLoading: boolean;

  /** Error message if any */
  error: string | null;
}

// ============================================================================
// Actions
// ============================================================================

export type QuotaAction =
  | { type: 'LOADING' }
  | { type: 'UPDATE'; payload: Omit<QuotaState, 'isLoading' | 'error' | 'sessionStart'> }
  | { type: 'ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

// ============================================================================
// Configuration
// ============================================================================

export interface QuotaConfig {
  warningThreshold: number;
  refreshInterval: number;
  pinnedModels: string[];
  displayStyle: 'percentage' | 'progressBar' | 'dots';
}
