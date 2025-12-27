"use strict";
/**
 * Usage Insights Module
 * Tracks quota usage patterns and provides predictive analytics.
 * Unique feature that differentiates us from competitors.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightsService = void 0;
const vscode = require("vscode");
const STORAGE_KEY = 'antigravity.quotaHistory_v2';
const MAX_HISTORY_HOURS = 24;
class InsightsService {
    constructor(globalState) {
        this.history = [];
        this.sessionStartQuotas = new Map();
        this.globalState = globalState;
        this.sessionStartTime = new Date();
        this.loadHistory();
    }
    loadHistory() {
        const stored = this.globalState.get(STORAGE_KEY, []);
        const cutoff = Date.now() - MAX_HISTORY_HOURS * 60 * 60 * 1000;
        this.history = stored
            .filter(e => e.timestamp > cutoff)
            .map(e => ({
            timestamp: new Date(e.timestamp),
            models: new Map(Object.entries(e.models))
        }));
    }
    async saveHistory() {
        const cutoff = Date.now() - MAX_HISTORY_HOURS * 60 * 60 * 1000;
        const toStore = this.history
            .filter(e => e.timestamp.getTime() > cutoff)
            .map(e => ({
            timestamp: e.timestamp.getTime(),
            models: Object.fromEntries(e.models)
        }));
        await this.globalState.update(STORAGE_KEY, toStore);
    }
    /**
     * Record a new snapshot and return enriched data with insights
     */
    analyze(snapshot, pinnedModels = []) {
        // Record history
        this.recordSnapshot(snapshot);
        // Initialize session start if first time seeing these models
        this.initSessionStart(snapshot);
        // Analyze each model
        const modelsWithInsights = snapshot.models.map(model => this.analyzeModel(model, snapshot, pinnedModels));
        // Sort by: 1) Pinned models first, 2) Active model, 3) Lowest remaining %
        modelsWithInsights.sort((a, b) => {
            if (a.insights.isPinned && !b.insights.isPinned)
                return -1;
            if (!a.insights.isPinned && b.insights.isPinned)
                return 1;
            if (a.insights.isActive && !b.insights.isActive)
                return -1;
            if (!a.insights.isActive && b.insights.isActive)
                return 1;
            return a.remainingPercent - b.remainingPercent;
        });
        // Apply grouping if enabled
        const config = vscode.workspace.getConfiguration('antigravity');
        const enableGrouping = config.get('enableGrouping', false);
        const finalModels = enableGrouping
            ? this.groupSimilarModels(modelsWithInsights)
            : modelsWithInsights;
        // Calculate overall health
        const { overallHealth, healthLabel } = this.calculateOverallHealth(finalModels);
        // Calculate total session usage
        const totalSessionUsage = finalModels.length > 0
            ? finalModels.reduce((sum, m) => sum + m.insights.sessionUsage, 0) / finalModels.length
            : 0;
        return {
            ...snapshot,
            modelsWithInsights: finalModels,
            overallHealth,
            healthLabel,
            sessionStartTime: this.sessionStartTime,
            totalSessionUsage: Math.round(totalSessionUsage),
            usageBuckets: this.calculateUsageBuckets(24 * 60, 60) // 24 hours, 60 min buckets
        };
    }
    /**
     * Group models with identical quota status (same %, same reset time)
     */
    groupSimilarModels(models) {
        const groups = new Map();
        for (const model of models) {
            // Create fingerprint: percent + reset time
            const fingerprint = `${model.remainingPercent}-${model.timeUntilReset || 'none'}`;
            if (!groups.has(fingerprint)) {
                groups.set(fingerprint, []);
            }
            groups.get(fingerprint).push(model);
        }
        const result = [];
        for (const [_, groupModels] of groups) {
            if (groupModels.length === 1) {
                result.push(groupModels[0]);
            }
            else {
                // Create grouped model
                const first = groupModels[0];
                const names = groupModels.map(m => m.label.split(' ')[0]).join(', ');
                result.push({
                    ...first,
                    label: `${names} (${groupModels.length})`,
                    modelId: `group-${first.modelId}`,
                });
            }
        }
        return result;
    }
    recordSnapshot(snapshot) {
        const entry = {
            timestamp: snapshot.timestamp,
            models: new Map()
        };
        for (const model of snapshot.models) {
            entry.models.set(model.modelId, model.remainingPercent);
        }
        this.history.push(entry);
        this.saveHistory(); // Auto-save on update
    }
    initSessionStart(snapshot) {
        for (const model of snapshot.models) {
            if (!this.sessionStartQuotas.has(model.modelId)) {
                this.sessionStartQuotas.set(model.modelId, model.remainingPercent);
            }
        }
    }
    analyzeModel(model, snapshot, pinnedModels) {
        const burnRate = this.calculateBurnRate(model.modelId);
        const sessionUsage = this.calculateSessionUsage(model.modelId, model.remainingPercent);
        const isActive = this.detectActiveModel(model, snapshot);
        const isPinned = this.isPinned(model.label, pinnedModels);
        let predictedExhaustion;
        let predictedExhaustionLabel;
        if (burnRate > 0 && model.remainingPercent > 0) {
            const hoursUntilEmpty = model.remainingPercent / burnRate;
            predictedExhaustion = new Date(Date.now() + hoursUntilEmpty * 60 * 60 * 1000);
            predictedExhaustionLabel = this.formatPrediction(hoursUntilEmpty);
        }
        else if (model.isExhausted) {
            predictedExhaustionLabel = 'Exhausted';
        }
        else {
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
                isActive,
                isPinned,
                historyData: this.getHistoryData(model.modelId)
            }
        };
    }
    getHistoryData(modelId) {
        // Return last 20 points
        return this.history.slice(-20).map(entry => entry.models.get(modelId) ?? 100);
    }
    calculateBurnRate(modelId) {
        if (this.history.length < 2)
            return 0;
        const oldest = this.history[0];
        const newest = this.history[this.history.length - 1];
        const oldValue = oldest.models.get(modelId);
        const newValue = newest.models.get(modelId);
        if (oldValue === undefined || newValue === undefined)
            return 0;
        const deltaPercent = oldValue - newValue;
        const deltaHours = (newest.timestamp.getTime() - oldest.timestamp.getTime()) / (1000 * 60 * 60);
        if (deltaHours <= 0)
            return 0;
        // Return % per hour, minimum 0
        return Math.max(0, deltaPercent / deltaHours);
    }
    calculateSessionUsage(modelId, currentPercent) {
        const startPercent = this.sessionStartQuotas.get(modelId);
        if (startPercent === undefined)
            return 0;
        return Math.max(0, startPercent - currentPercent);
    }
    detectActiveModel(model, snapshot) {
        if (this.history.length >= 2) {
            const burnRates = snapshot.models.map(m => ({
                id: m.modelId,
                rate: this.calculateBurnRate(m.modelId)
            }));
            const maxBurnRate = Math.max(...burnRates.map(b => b.rate));
            if (maxBurnRate > 0.5) {
                const activeId = burnRates.find(b => b.rate === maxBurnRate)?.id;
                if (activeId === model.modelId)
                    return true;
            }
        }
        if (this.lastActiveModelId === model.modelId)
            return true;
        const lowestRemaining = Math.min(...snapshot.models.map(m => m.remainingPercent));
        if (model.remainingPercent === lowestRemaining && lowestRemaining < 90) {
            return true;
        }
        return false;
    }
    getTrendDirection(remainingPercent, burnRate) {
        if (remainingPercent <= 10 || burnRate > 20)
            return 'critical';
        if (remainingPercent <= 25 || burnRate > 10)
            return 'warning';
        if (burnRate > 2)
            return 'decreasing';
        return 'stable';
    }
    getBurnRateLabel(burnRate) {
        if (burnRate <= 0.5)
            return 'Minimal';
        if (burnRate <= 2)
            return 'Slow';
        if (burnRate <= 5)
            return 'Moderate';
        if (burnRate <= 15)
            return 'Fast';
        return 'Very Fast';
    }
    formatPrediction(hours) {
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
    calculateOverallHealth(models) {
        if (models.length === 0) {
            return { overallHealth: 100, healthLabel: 'Unknown' };
        }
        let totalWeight = 0;
        let weightedSum = 0;
        for (const model of models) {
            const weight = model.insights.isActive ? 3 : 1;
            totalWeight += weight;
            weightedSum += model.remainingPercent * weight;
        }
        const overallHealth = Math.round(weightedSum / totalWeight);
        let healthLabel;
        if (overallHealth >= 75)
            healthLabel = 'Excellent';
        else if (overallHealth >= 50)
            healthLabel = 'Good';
        else if (overallHealth >= 25)
            healthLabel = 'Low';
        else
            healthLabel = 'Critical';
        return { overallHealth, healthLabel };
    }
    /**
     * Calculate usage buckets for bar charts (consumption deltas)
     */
    calculateUsageBuckets(displayMinutes, bucketMinutes) {
        const now = Date.now();
        const startTime = now - displayMinutes * 60 * 1000;
        const buckets = [];
        const bucketCount = Math.ceil(displayMinutes / bucketMinutes);
        // Filter history to relevant range
        const relevantHistory = this.history.filter(e => e.timestamp.getTime() > startTime - bucketMinutes * 60 * 1000);
        // Find all model IDs
        const modelIds = new Set();
        relevantHistory.forEach(e => e.models.forEach((_, key) => modelIds.add(key)));
        for (let i = 0; i < bucketCount; i++) {
            const bucketStart = startTime + i * bucketMinutes * 60 * 1000;
            const bucketEnd = Math.min(bucketStart + bucketMinutes * 60 * 1000, now);
            const pointsInBucket = relevantHistory.filter(e => {
                const t = e.timestamp.getTime();
                return t >= bucketStart && t < bucketEnd;
            });
            // Determine start and end values for this bucket
            let startEntry;
            let endEntry;
            // Try to find a point just before bucketStart
            const pointsBefore = relevantHistory.filter(e => e.timestamp.getTime() < bucketStart);
            if (pointsBefore.length > 0) {
                startEntry = pointsBefore[pointsBefore.length - 1];
                endEntry = pointsInBucket.length > 0 ? pointsInBucket[pointsInBucket.length - 1] : undefined;
            }
            else if (pointsInBucket.length >= 2) {
                startEntry = pointsInBucket[0];
                endEntry = pointsInBucket[pointsInBucket.length - 1];
            }
            const items = [];
            if (startEntry && endEntry) {
                for (const id of modelIds) {
                    const startVal = startEntry.models.get(id);
                    const endVal = endEntry.models.get(id);
                    if (startVal !== undefined && endVal !== undefined) {
                        const used = startVal - endVal;
                        if (used > 0) {
                            items.push({ groupId: id, usage: used });
                        }
                    }
                }
            }
            buckets.push({
                startTime: bucketStart,
                endTime: bucketEnd,
                items
            });
        }
        return buckets;
    }
    getStatusSummary(snapshot) {
        const activeModel = snapshot.modelsWithInsights.find(m => m.insights.isActive);
        if (activeModel) {
            return `${this.getShortName(activeModel.label)}: ${activeModel.remainingPercent}%`;
        }
        return `Health: ${snapshot.overallHealth}%`;
    }
    getShortName(label) {
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
            if (isPro)
                short = 'Pro';
            if (isFlash)
                short = 'Flash';
            if (isHigh)
                short += '↑';
            if (isLow)
                short += '↓';
            return short;
        }
        if (label.includes('GPT') || label.includes('O3')) {
            return 'GPT';
        }
        return label.split(' ')[0].substring(0, 6);
    }
    isPinned(label, pinnedModels) {
        if (!pinnedModels || pinnedModels.length === 0)
            return false;
        return pinnedModels.some(pin => label.toLowerCase().includes(pin.toLowerCase()));
    }
}
exports.InsightsService = InsightsService;
//# sourceMappingURL=insights.js.map