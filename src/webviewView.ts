/**
 * Sidebar View Provider - Invisible Interface Edition
 * Compact, integrated quota dashboard.
 */

import * as vscode from 'vscode';
import { SnapshotWithInsights, ModelWithInsights, UsageBucket } from './insights';
import { CacheInfo } from './cacheService';

export class QuotaViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'antigravity-usage.quotaView';

  private _view?: vscode.WebviewView;
  private lastSnapshot?: SnapshotWithInsights;
  private lastCacheInfo?: CacheInfo;
  private showInsights = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [
        this._extensionUri
      ]
    };

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.command) {
        case 'toggleInsights':
          {
            this.showInsights = !this.showInsights;
            if (this.lastSnapshot) {
              this.update(this.lastSnapshot, this.lastCacheInfo);
            }
            break;
          }
        case 'cleanCache':
          vscode.commands.executeCommand('antigravity-quota.cleanCache');
          break;
        case 'manageCache':
          vscode.commands.executeCommand('antigravity-quota.manageCache');
          break;
      }
    });

    if (this.lastSnapshot) {
      this.update(this.lastSnapshot);
    }
  }

  public update(snapshot: SnapshotWithInsights, cacheInfo?: CacheInfo) {
    this.lastSnapshot = snapshot;
    if (cacheInfo) {
      this.lastCacheInfo = cacheInfo;
    }
    if (this._view) {
      this._view.webview.html = this.getHtmlContent(snapshot, this.lastCacheInfo);
    }
  }

  private getHtmlContent(snapshot: SnapshotWithInsights, cacheInfo?: CacheInfo): string {
    const modelsHtml = snapshot.modelsWithInsights
      .map(model => this.renderModelRow(model))
      .join('');

    const creditsHtml = snapshot.promptCredits
      ? this.renderCredits(snapshot.promptCredits)
      : '';

    const historyHtml = this.renderUsageHistory(snapshot.usageBuckets);

    const cacheHtml = cacheInfo ? this.renderCacheInfo(cacheInfo) : '';

    const insightsToggle = this.showInsights ? 'Hide insights' : 'Show insights';
    const timestamp = snapshot.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quota</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 16px 20px;
      line-height: 1.6;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .header h1 {
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .header .time {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    /* Model List */
    .model-list {
      margin-bottom: 16px;
    }

    .model-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .model-row:last-child {
      border-bottom: none;
    }

    .model-name {
      font-size: 13px;
      color: var(--vscode-foreground);
    }

    .model-name.active {
      font-weight: 600;
    }

    .model-right {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .model-percent {
      font-size: 13px;
      font-weight: 500;
      min-width: 40px;
      text-align: right;
    }

    .model-percent.critical { color: var(--vscode-errorForeground); }
    .model-percent.low { color: var(--vscode-editorWarning-foreground); }

    .model-reset {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      min-width: 50px;
    }

    .pin-icon {
      font-size: 11px;
      margin-right: 6px;
      opacity: 0.8;
    }

    /* Sparkline */
    .sparkline {
      width: 48px;
      height: 16px;
      opacity: 0.6;
    }

    .sparkline polyline {
      fill: none;
      stroke: var(--vscode-foreground);
      stroke-width: 1.5;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    /* Usage History Chart */
    .history-section {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }

    .chart-container {
      display: flex;
      align-items: flex-end;
      height: 60px;
      gap: 2px;
      margin-bottom: 8px;
    }

    .chart-bar {
      flex: 1;
      background: var(--vscode-charts-blue);
      opacity: 0.7;
      min-height: 2px;
      border-radius: 1px;
      position: relative;
    }

    .chart-bar:hover {
      opacity: 1;
    }

    .chart-bar:hover::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      padding: 4px;
      border-radius: 4px;
      font-size: 10px;
      white-space: nowrap;
      z-index: 10;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }

    /* Cache Info */
    .cache-section {
       margin-top: 20px;
       padding-top: 12px;
       border-top: 1px solid var(--vscode-panel-border);
    }

    .cache-stats {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
    }

    .actions {
      display: flex;
      gap: 8px;
    }

    .btn {
       background: var(--vscode-button-background);
       color: var(--vscode-button-foreground);
       border: none;
       padding: 4px 8px;
       border-radius: 2px;
       cursor: pointer;
       font-size: 11px;
    }

    .btn:hover {
       background: var(--vscode-button-hoverBackground);
    }

    .btn-secondary {
       background: var(--vscode-button-secondaryBackground);
       color: var(--vscode-button-secondaryForeground);
    }

    .btn-secondary:hover {
       background: var(--vscode-button-secondaryHoverBackground);
    }

    /* Insights (hidden by default) */
    .model-insights {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      padding: 4px 0 8px 0;
      display: ${this.showInsights ? 'block' : 'none'};
    }

    /* Credits */
    .credits {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      padding: 12px 0;
      border-top: 1px solid var(--vscode-panel-border);
    }

    /* Footer */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      margin-top: 8px;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      font-size: 11px;
      cursor: pointer;
      padding: 0;
    }

    .toggle-btn:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Quota</h1>
    <span class="time">${timestamp}</span>
  </div>

  <div class="model-list">
    ${modelsHtml}
  </div>

  ${creditsHtml}
  ${historyHtml}
  ${cacheHtml}

  <div class="footer">
    <button class="toggle-btn" onclick="toggleInsights()">${insightsToggle}</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function toggleInsights() {
      vscode.postMessage({ command: 'toggleInsights' });
    }
    function cleanCache() {
      vscode.postMessage({ command: 'cleanCache' });
    }
    function manageCache() {
      vscode.postMessage({ command: 'manageCache' });
    }
  </script>
</body>
</html>`;
  }

  private renderModelRow(model: ModelWithInsights): string {
    const activeClass = model.insights.isActive ? 'active' : '';
    const percentClass = this.getPercentClass(model.remainingPercent);
    const reset = model.timeUntilReset || '';
    const pinHtml = model.insights.isPinned ? '<span class="pin-icon" title="Pinned">📌</span>' : '';

    // Insights row (only shown when toggled)
    const insightsHtml = `
      <div class="model-insights">
        Burn: ${model.insights.burnRateLabel} ·
        ETA: ${model.insights.predictedExhaustionLabel || '—'}
      </div>
    `;

    return `
      <div class="model-row">
        <span class="model-name ${activeClass}">${pinHtml}${model.label}</span>
        <div class="model-right">
          ${this.renderSparkline(model.insights.historyData)}
          <span class="model-reset">${reset}</span>
          <span class="model-percent ${percentClass}">${model.remainingPercent}%</span>
        </div>
      </div>
      ${this.showInsights ? insightsHtml : ''}
    `;
  }

  private renderSparkline(data: number[]): string {
    if (!data || data.length < 2) return '';

    const width = 48;
    const height = 16;
    const padding = 2;

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y} `;
    }).join(' ');

    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}"><polyline points="${points}"/></svg>`;
  }

  private renderCredits(credits: { available: number; monthly: number; remainingPercent: number }): string {
    return `
      <div class="credits">
        Credits: ${credits.available.toLocaleString()} / ${credits.monthly.toLocaleString()}
      </div>
    `;
  }

  private getPercentClass(percent: number): string {
    if (percent < 15) return 'critical';
    if (percent < 30) return 'low';
    return '';
  }

  private renderUsageHistory(buckets: UsageBucket[]): string {
    if (!buckets || buckets.length < 2) return '';

    // Calculate max usage in any bucket for scaling
    const maxUsage = Math.max(...buckets.map(b => b.items.reduce((sum, item) => sum + item.usage, 0)), 10);

    // Generate bars
    const barsHtml = buckets.map(bucket => {
      const totalUsage = bucket.items.reduce((sum, item) => sum + item.usage, 0);
      const heightPercent = Math.min((totalUsage / maxUsage) * 100, 100);
      const timeLabel = new Date(bucket.startTime).getHours() + ':00';
      const tooltip = `${timeLabel}: ${totalUsage.toFixed(1)}%`;

      return `<div class="chart-bar" style="height: ${heightPercent}%;" data-tooltip="${tooltip}"></div>`;
    }).join('');

    return `
       <div class="history-section">
         <div class="section-title">24h Usage</div>
         <div class="chart-container">
           ${barsHtml}
         </div>
       </div>
    `;
  }

  private renderCacheInfo(info: CacheInfo): string {
    const sizeMB = (info.totalSize / 1024 / 1024).toFixed(1);
    return `
       <div class="cache-section">
          <div class="section-title">Cache</div>
          <div class="cache-stats">
             <span>${sizeMB} MB Total</span>
             <span>${info.brainCount} Tasks</span>
          </div>
          <div class="actions">
             <button class="btn" onclick="manageCache()">Manage</button>
             <button class="btn btn-secondary" onclick="cleanCache()">Clean</button>
          </div>
       </div>
     `;
  }
}
