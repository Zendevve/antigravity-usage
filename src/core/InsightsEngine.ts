/**
 * InsightsEngine - Analytics Layer
 *
 * Pure analytical functions that transform raw quota data into insights.
 * No direct VS Code dependencies - receives config as parameters.
 *
 * Laws of UX Applied:
 * - Law of Prägnanz: Simple, focused calculations
 * - Miller's Law: Clear mental model for analytics
 */

import * as vscode from 'vscode';
import {
  ModelQuota,
  ModelInsights,
  EnrichedModel,
  HealthStatus,
  HealthLevel,
  CreditInfo,
  QuotaConfig,
} from './types';

// ============================================================================
// History Storage
// ============================================================================

interface HistoryEntry {
  timestamp: number;
  models: Record<string, number>; // modelId -> remainingPercent
}

const STORAGE_KEY = 'antigravity.quotaHistory_v2';
const MAX_HISTORY_HOURS = 24;
const MAX_HISTORY_POINTS = 200;

// ============================================================================
// InsightsEngine Class
// ============================================================================

export class InsightsEngine {
  private history: HistoryEntry[] = [];
  private sessionStartTime: Date;
  private sessionStartQuotas: Map<string, number> = new Map();
  private lastActiveModelId: string | undefined;
  private globalState: vscode.Memento;

  constructor(globalState: vscode.Memento) {
    this.globalState = globalState;
    this.sessionStartTime = new Date();
    this.loadHistory();
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Analyze raw model data and return enriched models with insights
   */
  analyze(
    models: ModelQuota[],
    config: QuotaConfig
  ): { models: EnrichedModel[]; health: HealthStatus } {
    // Record current snapshot
    this.recordHistory(models);

    // Initialize session tracking for new models
    this.initSessionTracking(models);

    // Analyze each model
    const enriched = models.map(model =>
      this.analyzeModel(model, models, config.pinnedModels)
    );

    // Sort by priority: pinned > active > lowest remaining
    enriched.sort((a, b) => {
      if (a.insights.isPinned && !b.insights.isPinned) return -1;
      if (!a.insights.isPinned && b.insights.isPinned) return 1;
      if (a.insights.isActive && !b.insights.isActive) return -1;
      if (!a.insights.isActive && b.insights.isActive) return 1;
      return a.remainingPercent - b.remainingPercent;
    });

    // Calculate overall health
    const health = this.calculateHealth(enriched);

    return { models: enriched, health };
  }

  /**
   * Get session start time
   */
  getSessionStart(): Date {
    return this.sessionStartTime;
  }

  /**
   * Clear all history (for testing/reset)
   */
  async clearHistory(): Promise<void> {
    this.history = [];
    await this.globalState.update(STORAGE_KEY, []);
  }

  // ============================================================================
  // Private: History Management
  // ============================================================================

  private loadHistory(): void {
    const stored = this.globalState.get<HistoryEntry[]>(STORAGE_KEY, []);
    const cutoff = Date.now() - MAX_HISTORY_HOURS * 60 * 60 * 1000;

    this.history = stored.filter(e => e.timestamp > cutoff);
    console.log(`[InsightsEngine] Loaded ${this.history.length} history entries`);
  }

  private async saveHistory(): Promise<void> {
    const cutoff = Date.now() - MAX_HISTORY_HOURS * 60 * 60 * 1000;
    const toStore = this.history
      .filter(e => e.timestamp > cutoff)
      .slice(-MAX_HISTORY_POINTS);

    await this.globalState.update(STORAGE_KEY, toStore);
  }

  private recordHistory(models: ModelQuota[]): void {
    const entry: HistoryEntry = {
      timestamp: Date.now(),
      models: {},
    };

    for (const model of models) {
      entry.models[model.modelId] = model.remainingPercent;
    }

    this.history.push(entry);
    this.saveHistory();
  }

  private initSessionTracking(models: ModelQuota[]): void {
    for (const model of models) {
      if (!this.sessionStartQuotas.has(model.modelId)) {
        this.sessionStartQuotas.set(model.modelId, model.remainingPercent);
      }
    }
  }

  // ============================================================================
  // Private: Model Analysis
  // ============================================================================

  private analyzeModel(
    model: ModelQuota,
    allModels: ModelQuota[],
    pinnedModels: string[]
  ): EnrichedModel {
    const burnRate = this.calculateBurnRate(model.modelId);
    const sessionUsage = this.calculateSessionUsage(model.modelId, model.remainingPercent);
    const isActive = this.detectActiveModel(model, allModels);
    const isPinned = this.checkPinned(model.label, pinnedModels);
    const historyData = this.getHistoryData(model.modelId);

    // Calculate prediction
    let predictedExhaustion: Date | undefined;
    let predictedExhaustionLabel: string | undefined;

    if (burnRate > 0 && model.remainingPercent > 0) {
      const hoursUntilEmpty = model.remainingPercent / burnRate;
      predictedExhaustion = new Date(Date.now() + hoursUntilEmpty * 60 * 60 * 1000);
      predictedExhaustionLabel = this.formatPrediction(hoursUntilEmpty);
    } else if (model.isExhausted) {
      predictedExhaustionLabel = 'Exhausted';
    } else {
      predictedExhaustionLabel = 'Safe for now';
    }

    // Track active model
    if (isActive) {
      this.lastActiveModelId = model.modelId;
    }

    const insights: ModelInsights = {
      burnRate,
      burnRateLabel: this.getBurnRateLabel(burnRate),
      predictedExhaustion,
      predictedExhaustionLabel,
      sessionUsage,
      isActive,
      isPinned,
      historyData,
    };

    return { ...model, insights };
  }

  private calculateBurnRate(modelId: string): number {
    if (this.history.length < 2) return 0;

    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];

    const oldValue = oldest.models[modelId];
    const newValue = newest.models[modelId];

    if (oldValue === undefined || newValue === undefined) return 0;

    const deltaPercent = oldValue - newValue;
    const deltaHours = (newest.timestamp - oldest.timestamp) / (1000 * 60 * 60);

    if (deltaHours <= 0) return 0;

    return Math.max(0, deltaPercent / deltaHours);
  }

  private calculateSessionUsage(modelId: string, currentPercent: number): number {
    const startPercent = this.sessionStartQuotas.get(modelId);
    if (startPercent === undefined) return 0;
    return Math.max(0, startPercent - currentPercent);
  }

  private detectActiveModel(model: ModelQuota, allModels: ModelQuota[]): boolean {
    // Check if this model has highest burn rate
    if (this.history.length >= 2) {
      const burnRates = allModels.map(m => ({
        id: m.modelId,
        rate: this.calculateBurnRate(m.modelId),
      }));

      const maxBurnRate = Math.max(...burnRates.map(b => b.rate));
      if (maxBurnRate > 0.5) {
        const activeId = burnRates.find(b => b.rate === maxBurnRate)?.id;
        if (activeId === model.modelId) return true;
      }
    }

    // Check if this was the last active model
    if (this.lastActiveModelId === model.modelId) return true;

    // Fallback: lowest remaining (if significantly used)
    const lowestRemaining = Math.min(...allModels.map(m => m.remainingPercent));
    if (model.remainingPercent === lowestRemaining && lowestRemaining < 90) {
      return true;
    }

    return false;
  }

  private getHistoryData(modelId: string): number[] {
    return this.history.slice(-20).map(entry => entry.models[modelId] ?? 100);
  }

  private checkPinned(label: string, pinnedModels: string[]): boolean {
    if (!pinnedModels || pinnedModels.length === 0) return false;
    return pinnedModels.some(pin =>
      label.toLowerCase().includes(pin.toLowerCase())
    );
  }

  // ============================================================================
  // Private: Health Calculation
  // ============================================================================

  private calculateHealth(models: EnrichedModel[]): HealthStatus {
    if (models.length === 0) {
      return { score: 100, level: 'excellent', label: 'Unknown' };
    }

    // Weighted average: active models count more
    let totalWeight = 0;
    let weightedSum = 0;

    for (const model of models) {
      const weight = model.insights.isActive ? 3 : 1;
      totalWeight += weight;
      weightedSum += model.remainingPercent * weight;
    }

    const score = Math.round(weightedSum / totalWeight);
    const { level, label } = this.getHealthLevel(score);

    return { score, level, label };
  }

  private getHealthLevel(score: number): { level: HealthLevel; label: string } {
    if (score >= 75) return { level: 'excellent', label: 'Excellent' };
    if (score >= 50) return { level: 'good', label: 'Good' };
    if (score >= 25) return { level: 'low', label: 'Low' };
    return { level: 'critical', label: 'Critical' };
  }

  // ============================================================================
  // Private: Formatting
  // ============================================================================

  private getBurnRateLabel(burnRate: number): string {
    if (burnRate <= 0.5) return 'Minimal';
    if (burnRate <= 2) return 'Slow';
    if (burnRate <= 5) return 'Moderate';
    if (burnRate <= 15) return 'Fast';
    return 'Very Fast';
  }

  private formatPrediction(hours: number): string {
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return days === 1 ? '~1 day' : `~${days} days`;
    }
    if (hours > 1) {
      const h = Math.floor(hours);
      const m = Math.round((hours - h) * 60);
      return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
    }
    const mins = Math.round(hours * 60);
    return mins > 0 ? `~${mins}m` : '<1m';
  }
}
