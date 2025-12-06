/**
 * Status Bar Manager - Enhanced Edition
 * Unique visual identity with ring indicators, active model detection, and rich tooltips.
 */

import * as vscode from 'vscode';
import { ModelQuota } from './quotaService';
import { SnapshotWithInsights, ModelWithInsights } from './insights';

// Unique ring-style progress indicators (instead of typical █░ bars)
const RINGS = ['○', '◔', '◑', '◕', '●']; // 0%, 25%, 50%, 75%, 100%
const MINI_BARS = ['⣀', '⣤', '⣶', '⣿']; // Alternative compact style

// Trend indicators
const TREND_ICONS: Record<string, string> = {
  stable: '→',
  decreasing: '↘',
  warning: '⚠',
  critical: '🔥'
};

// Health score indicators
const HEALTH_ICONS: Record<string, string> = {
  Excellent: '✨',
  Good: '✓',
  Low: '⚡',
  Critical: '💀',
  Unknown: '?'
};

export class StatusBarManager implements vscode.Disposable {
  private statusBarItem: vscode.StatusBarItem;
  private lastSnapshot: SnapshotWithInsights | undefined;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'antigravity-quota.showDashboard';
    this.statusBarItem.text = '⚡ AG Loading...';
    this.statusBarItem.tooltip = 'Antigravity Usage - Loading...';
    this.statusBarItem.show();
  }

  public showDetecting() {
    this.statusBarItem.text = '⚡ Detecting...';
    this.statusBarItem.tooltip = 'Detecting AntiGravity process...';
    this.statusBarItem.backgroundColor = undefined;
  }

  public showInitializing() {
    this.statusBarItem.text = '⚡ Initializing...';
    this.statusBarItem.tooltip = 'AntiGravity detected, initializing...';
    this.statusBarItem.backgroundColor = undefined;
  }

  public showFetching() {
    this.statusBarItem.text = '⚡ Syncing...';
    this.statusBarItem.tooltip = 'Fetching quota data...';
    this.statusBarItem.backgroundColor = undefined;
  }

  public showRetrying(attempt: number, maxAttempts: number) {
    this.statusBarItem.text = `⚡ Retry ${attempt}/${maxAttempts}`;
    this.statusBarItem.tooltip = `Retrying detection... (${attempt}/${maxAttempts})`;
    this.statusBarItem.backgroundColor = undefined;
  }

  public showError(message: string) {
    this.statusBarItem.text = '⚡ Error';
    this.statusBarItem.tooltip = `Error: ${message}\n\nClick to retry`;
    this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
  }

  /**
   * Main update with insights data - shows active model prominently
   */
  public updateWithInsights(snapshot: SnapshotWithInsights) {
    this.lastSnapshot = snapshot;

    const models = snapshot.modelsWithInsights;
    if (!models || models.length === 0) {
      this.statusBarItem.text = '⚡ No Data';
      this.statusBarItem.tooltip = 'No quota information available';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    // Find active model (first in sorted list)
    const activeModel = models.find(m => m.insights.isActive) || models[0];
    const healthIcon = HEALTH_ICONS[snapshot.healthLabel] || '?';

    // Build compact status bar display
    // Format: ⚡ [Ring] ModelName 75% ↘
    const ring = this.getRingIcon(activeModel.remainingPercent);
    const shortName = this.getShortName(activeModel.label);
    const trend = TREND_ICONS[activeModel.insights.trendDirection];

    // Show active model + overall health
    let displayText = `⚡ ${ring} ${shortName} ${activeModel.remainingPercent}%`;

    // Add trend icon if not stable
    if (activeModel.insights.trendDirection !== 'stable') {
      displayText += ` ${trend}`;
    }

    // Set background color based on health
    let bgColor: vscode.ThemeColor | undefined;
    if (snapshot.healthLabel === 'Critical' || activeModel.isExhausted) {
      bgColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (snapshot.healthLabel === 'Low') {
      bgColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    }

    this.statusBarItem.text = displayText;
    this.statusBarItem.backgroundColor = bgColor;
    this.statusBarItem.tooltip = this.buildRichTooltip(snapshot);
  }

  /**
   * Fallback for basic quota data (without insights)
   */
  public update(quotas: ModelQuota[]) {
    if (!quotas || quotas.length === 0) {
      this.statusBarItem.text = '⚡ No Data';
      this.statusBarItem.tooltip = 'No quota information available';
      this.statusBarItem.backgroundColor = undefined;
      return;
    }

    // Find most used model (lowest remaining)
    const sorted = [...quotas].sort((a, b) => a.remainingPercent - b.remainingPercent);
    const primary = sorted[0];

    const ring = this.getRingIcon(primary.remainingPercent);
    const shortName = this.getShortName(primary.label);

    this.statusBarItem.text = `⚡ ${ring} ${shortName} ${primary.remainingPercent}%`;

    // Set background based on level
    if (primary.isExhausted || primary.remainingPercent < 10) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (primary.remainingPercent < 30) {
      this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.statusBarItem.backgroundColor = undefined;
    }

    // Build simple tooltip
    const lines = quotas.map(q => {
      const bar = this.buildMiniBar(q.remainingPercent);
      const resetInfo = q.timeUntilReset ? ` (resets ${q.timeUntilReset})` : '';
      const exhausted = q.isExhausted ? ' ⛔' : '';
      return `${bar} ${q.label}: ${q.remainingPercent}%${exhausted}${resetInfo}`;
    });
    this.statusBarItem.tooltip = `Antigravity Quota\n─────────────\n${lines.join('\n')}\n\n💡 Click for dashboard`;
  }

  private getRingIcon(percent: number): string {
    if (percent >= 90) return RINGS[4]; // ●
    if (percent >= 65) return RINGS[3]; // ◕
    if (percent >= 40) return RINGS[2]; // ◑
    if (percent >= 15) return RINGS[1]; // ◔
    return RINGS[0]; // ○
  }

  private buildMiniBar(percent: number): string {
    // Use circle-based mini bar: ●●●○○ (5 chars)
    const filled = Math.round(percent / 20);
    const empty = 5 - filled;
    return '●'.repeat(filled) + '○'.repeat(empty);
  }

  private getShortName(label: string): string {
    // Make concise names for status bar
    if (label.includes('Claude')) {
      if (label.includes('Sonnet')) return 'Sonnet';
      if (label.includes('Opus')) return 'Opus';
      return 'Claude';
    }
    if (label.includes('Gemini')) {
      if (label.includes('Pro')) {
        if (label.includes('High')) return 'Pro↑';
        if (label.includes('Low')) return 'Pro↓';
        return 'Pro';
      }
      if (label.includes('Flash')) return 'Flash';
      return 'Gemini';
    }
    if (label.includes('GPT') || label.includes('O3')) {
      return 'GPT';
    }
    // Fallback: first 5 chars
    return label.split(' ')[0].substring(0, 5);
  }

  private buildRichTooltip(snapshot: SnapshotWithInsights): string {
    const lines: string[] = [];

    // Header with health
    const healthIcon = HEALTH_ICONS[snapshot.healthLabel];
    lines.push(`⚡ Antigravity Usage Dashboard`);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(``);
    lines.push(`${healthIcon} Overall Health: ${snapshot.overallHealth}% (${snapshot.healthLabel})`);
    lines.push(`📊 Session Usage: ${snapshot.totalSessionUsage}%`);
    lines.push(``);
    lines.push(`─── Models ───`);

    // Model details
    for (const model of snapshot.modelsWithInsights) {
      const bar = this.buildMiniBar(model.remainingPercent);
      const activeMarker = model.insights.isActive ? '▶ ' : '  ';
      const trend = TREND_ICONS[model.insights.trendDirection];

      lines.push(``);
      lines.push(`${activeMarker}${bar} ${model.label}`);
      lines.push(`     ${model.remainingPercent}% remaining ${trend}`);

      if (model.insights.burnRateLabel !== 'Minimal') {
        lines.push(`     Burn: ${model.insights.burnRateLabel} (${model.insights.burnRate.toFixed(1)}%/hr)`);
      }
      if (model.insights.predictedExhaustionLabel) {
        lines.push(`     ETA: ${model.insights.predictedExhaustionLabel}`);
      }
      if (model.timeUntilReset) {
        lines.push(`     Reset: ${model.timeUntilReset}`);
      }
    }

    // Prompt credits
    if (snapshot.promptCredits) {
      const pc = snapshot.promptCredits;
      lines.push(``);
      lines.push(`─── Credits ───`);
      lines.push(`💳 ${pc.available.toLocaleString()} / ${pc.monthly.toLocaleString()} (${pc.remainingPercent}%)`);
    }

    lines.push(``);
    lines.push(`💡 Click to open dashboard`);

    return lines.join('\n');
  }

  public getSnapshot(): SnapshotWithInsights | undefined {
    return this.lastSnapshot;
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
