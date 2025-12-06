/**
 * Usage Insights Module
 * Tracks quota usage patterns and provides predictive analytics.
 * Unique feature that differentiates us from competitors.
 */

import { ModelQuota, QuotaSnapshot, PromptCredits } from './quotaService';

export interface UsageInsight {
  burnRate: number;              // % per hour
  burnRateLabel: string;         // Human readable: "Fast" "Moderate" "Slow"
  predictedExhaustion?: Date;    // When will it run out
  predictedExhaustionLabel?: string; // "~2h 30m" or "Safe for today"
  trendDirection: 'stable' | 'decreasing' | 'warning' | 'critical';
  sessionUsage: number;          // % used in current session
  isActive: boolean;             // Is this the likely active model
}

export interface ModelWithInsights extends ModelQuota {
  insights: UsageInsight;
}

export interface SnapshotWithInsights extends QuotaSnapshot {
  modelsWithInsights: ModelWithInsights[];
  overallHealth: number;         // 0-100 overall health score
  healthLabel: string;           // "Excellent" "Good" "Low" "Critical"
  sessionStartTime: Date;
  totalSessionUsage: number;     // Average session usage across all models
}

interface HistoryEntry {
  timestamp: Date;
  models: Map<string, number>;   // modelId -> remainingPercent
}

const MAX_HISTORY = 20;

export class InsightsService {
  private history: HistoryEntry[] = [];
  private sessionStartTime: Date;
  private sessionStartQuotas: Map<string, number> = new Map();
  private lastActiveModelId: string | undefined;

  constructor() {
    this.sessionStartTime = new Date();
  }

  /**
   * Record a new snapshot and return enriched data with insights
   */
  public analyze(snapshot: QuotaSnapshot): SnapshotWithInsights {
    // Record history
    this.recordSnapshot(snapshot);

    // Initialize session start if first time seeing these models
    this.initSessionStart(snapshot);

    // Analyze each model
    const modelsWithInsights = snapshot.models.map(model =>
      this.analyzeModel(model, snapshot)
    );

    // Sort by: 1) Active model first, 2) Lowest remaining %
    modelsWithInsights.sort((a, b) => {
      if (a.insights.isActive && !b.insights.isActive) return -1;
      if (!a.insights.isActive && b.insights.isActive) return 1;
      return a.remainingPercent - b.remainingPercent;
    });

    // Calculate overall health
    const { overallHealth, healthLabel } = this.calculateOverallHealth(modelsWithInsights);

    // Calculate total session usage
    const totalSessionUsage = modelsWithInsights.length > 0
      ? modelsWithInsights.reduce((sum, m) => sum + m.insights.sessionUsage, 0) / modelsWithInsights.length
      : 0;

    return {
      ...snapshot,
      modelsWithInsights,
      overallHealth,
      healthLabel,
      sessionStartTime: this.sessionStartTime,
      totalSessionUsage: Math.round(totalSessionUsage)
    };
  }

  private recordSnapshot(snapshot: QuotaSnapshot): void {
    const entry: HistoryEntry = {
      timestamp: snapshot.timestamp,
      models: new Map()
    };

    for (const model of snapshot.models) {
      entry.models.set(model.modelId, model.remainingPercent);
    }

    this.history.push(entry);

    // Keep only the last N entries
    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }
  }

  private initSessionStart(snapshot: QuotaSnapshot): void {
    for (const model of snapshot.models) {
      if (!this.sessionStartQuotas.has(model.modelId)) {
        this.sessionStartQuotas.set(model.modelId, model.remainingPercent);
      }
    }
  }

  private analyzeModel(model: ModelQuota, snapshot: QuotaSnapshot): ModelWithInsights {
    const burnRate = this.calculateBurnRate(model.modelId);
    const sessionUsage = this.calculateSessionUsage(model.modelId, model.remainingPercent);
    const isActive = this.detectActiveModel(model, snapshot);

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

    const trendDirection = this.getTrendDirection(model.remainingPercent, burnRate);
    const burnRateLabel = this.getBurnRateLabel(burnRate);

    if (isActive) {
      this.lastActiveModelId = model.modelId;
    }

    return {
      ...model,
      insights: {
        burnRate,
        burnRateLabel,
        predictedExhaustion,
        predictedExhaustionLabel,
        trendDirection,
        sessionUsage,
        isActive
      }
    };
  }

  private calculateBurnRate(modelId: string): number {
    if (this.history.length < 2) return 0;

    const oldest = this.history[0];
    const newest = this.history[this.history.length - 1];

    const oldValue = oldest.models.get(modelId);
    const newValue = newest.models.get(modelId);

    if (oldValue === undefined || newValue === undefined) return 0;

    const deltaPercent = oldValue - newValue;
    const deltaHours = (newest.timestamp.getTime() - oldest.timestamp.getTime()) / (1000 * 60 * 60);

    if (deltaHours <= 0) return 0;

    // Return % per hour, minimum 0
    return Math.max(0, deltaPercent / deltaHours);
  }

  private calculateSessionUsage(modelId: string, currentPercent: number): number {
    const startPercent = this.sessionStartQuotas.get(modelId);
    if (startPercent === undefined) return 0;
    return Math.max(0, startPercent - currentPercent);
  }

  private detectActiveModel(model: ModelQuota, snapshot: QuotaSnapshot): boolean {
    // Strategy 1: Highest burn rate = most actively used
    if (this.history.length >= 2) {
      const burnRates = snapshot.models.map(m => ({
        id: m.modelId,
        rate: this.calculateBurnRate(m.modelId)
      }));

      const maxBurnRate = Math.max(...burnRates.map(b => b.rate));
      if (maxBurnRate > 0.5) { // Threshold: at least 0.5% per hour
        const activeId = burnRates.find(b => b.rate === maxBurnRate)?.id;
        if (activeId === model.modelId) return true;
      }
    }

    // Strategy 2: Last known active model
    if (this.lastActiveModelId === model.modelId) return true;

    // Strategy 3: Lowest remaining (most used) as fallback
    const lowestRemaining = Math.min(...snapshot.models.map(m => m.remainingPercent));
    if (model.remainingPercent === lowestRemaining && lowestRemaining < 90) {
      return true;
    }

    return false;
  }

  private getTrendDirection(remainingPercent: number, burnRate: number): 'stable' | 'decreasing' | 'warning' | 'critical' {
    if (remainingPercent <= 10 || burnRate > 20) return 'critical';
    if (remainingPercent <= 25 || burnRate > 10) return 'warning';
    if (burnRate > 2) return 'decreasing';
    return 'stable';
  }

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

  private calculateOverallHealth(models: ModelWithInsights[]): { overallHealth: number; healthLabel: string } {
    if (models.length === 0) {
      return { overallHealth: 100, healthLabel: 'Unknown' };
    }

    // Weighted average: active model counts more
    let totalWeight = 0;
    let weightedSum = 0;

    for (const model of models) {
      const weight = model.insights.isActive ? 3 : 1;
      totalWeight += weight;
      weightedSum += model.remainingPercent * weight;
    }

    const overallHealth = Math.round(weightedSum / totalWeight);

    let healthLabel: string;
    if (overallHealth >= 75) healthLabel = 'Excellent';
    else if (overallHealth >= 50) healthLabel = 'Good';
    else if (overallHealth >= 25) healthLabel = 'Low';
    else healthLabel = 'Critical';

    return { overallHealth, healthLabel };
  }

  /**
   * Get a brief status string for the status bar
   */
  public getStatusSummary(snapshot: SnapshotWithInsights): string {
    const activeModel = snapshot.modelsWithInsights.find(m => m.insights.isActive);
    if (activeModel) {
      return `${this.getShortName(activeModel.label)}: ${activeModel.remainingPercent}%`;
    }
    return `Health: ${snapshot.overallHealth}%`;
  }

  private getShortName(label: string): string {
    // Claude Sonnet 4.5 -> Claude S4.5
    // Gemini 3 Pro (High) -> G3P-H
    if (label.includes('Claude')) {
      const match = label.match(/Claude\s+(\w+)\s*([\d.]+)?/);
      if (match) {
        return `Claude ${match[1][0]}${match[2] || ''}`;
      }
      return 'Claude';
    }
    if (label.includes('Gemini')) {
      const isHigh = label.includes('High');
      const isLow = label.includes('Low');
      const isPro = label.includes('Pro');
      const isFlash = label.includes('Flash');
      let short = 'Gem';
      if (isPro) short = 'Pro';
      if (isFlash) short = 'Flash';
      if (isHigh) short += '↑';
      if (isLow) short += '↓';
      return short;
    }
    if (label.includes('GPT') || label.includes('O3')) {
      return 'GPT';
    }
    // Fallback: first word
    return label.split(' ')[0].substring(0, 6);
  }
}
