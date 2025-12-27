/**
 * QuotaStore - Single Source of Truth
 *
 * Implements a simple pub/sub pattern for reactive state management.
 *
 * Laws of UX Applied:
 * - Miller's Law: One place to understand all state
 * - Doherty Threshold: Synchronous updates, < 1ms dispatch
 */

import {
  QuotaState,
  QuotaAction,
  HealthStatus,
  EnrichedModel,
} from './types';

// ============================================================================
// Default State
// ============================================================================

function createDefaultState(): QuotaState {
  return {
    models: [],
    promptCredits: undefined,
    flowCredits: undefined,
    health: { score: 100, level: 'excellent', label: 'Unknown' },
    sessionStart: new Date(),
    lastUpdate: new Date(),
    isLoading: false,
    error: null,
  };
}

// ============================================================================
// Reducer
// ============================================================================

function reduce(state: QuotaState, action: QuotaAction): QuotaState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true, error: null };

    case 'UPDATE':
      return {
        ...state,
        ...action.payload,
        isLoading: false,
        error: null,
        lastUpdate: new Date(),
      };

    case 'ERROR':
      return { ...state, isLoading: false, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

// ============================================================================
// Store Class
// ============================================================================

type Subscriber = (state: QuotaState) => void;

export class QuotaStore {
  private state: QuotaState;
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    this.state = createDefaultState();
  }

  /**
   * Get current state (immutable snapshot)
   */
  getState(): QuotaState {
    return this.state;
  }

  /**
   * Get the primary (most important) model
   * - Pinned models first
   * - Then active model
   * - Then lowest remaining
   */
  getPrimaryModel(): EnrichedModel | undefined {
    return this.state.models[0];
  }

  /**
   * Get secondary models (all except primary)
   */
  getSecondaryModels(): EnrichedModel[] {
    return this.state.models.slice(1);
  }

  /**
   * Check if any model is in warning/danger state
   */
  hasWarning(threshold: number = 25): boolean {
    return this.state.models.some(m => m.remainingPercent < threshold);
  }

  /**
   * Dispatch an action to update state
   */
  dispatch(action: QuotaAction): void {
    const prevState = this.state;
    this.state = reduce(prevState, action);

    // Notify subscribers only if state actually changed
    if (this.state !== prevState) {
      this.notifySubscribers();
    }
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify all subscribers of state change
   */
  private notifySubscribers(): void {
    for (const subscriber of this.subscribers) {
      try {
        subscriber(this.state);
      } catch (error) {
        console.error('[QuotaStore] Subscriber error:', error);
      }
    }
  }

  /**
   * Reset to default state (for testing/cleanup)
   */
  reset(): void {
    this.state = createDefaultState();
    this.notifySubscribers();
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

// Optional: Create a singleton for easy access across modules
let _instance: QuotaStore | undefined;

export function getStore(): QuotaStore {
  if (!_instance) {
    _instance = new QuotaStore();
  }
  return _instance;
}

export function resetStore(): void {
  _instance = undefined;
}
