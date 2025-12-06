/**
 * WebView Dashboard Panel
 * Native VS Code styling - seamlessly integrates with Antigravity.
 */

import * as vscode from 'vscode';
import { SnapshotWithInsights, ModelWithInsights } from './insights';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private lastSnapshot: SnapshotWithInsights | undefined;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Two;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'antigravityDashboard',
      'Antigravity Usage',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel);
    return DashboardPanel.currentPanel;
  }

  public update(snapshot: SnapshotWithInsights) {
    this.lastSnapshot = snapshot;
    this.panel.webview.html = this.getHtmlContent(snapshot);
  }

  private getHtmlContent(snapshot: SnapshotWithInsights): string {
    const modelsHtml = snapshot.modelsWithInsights.map(model => this.renderModelCard(model)).join('');
    const creditsHtml = snapshot.promptCredits ? this.renderCreditsCard(snapshot.promptCredits) : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Usage</title>
  <style>
    :root {
      --ag-accent: var(--vscode-progressBar-background, #0078d4);
      --ag-accent-soft: color-mix(in srgb, var(--ag-accent) 15%, transparent);
      --ag-success: #3fb950;
      --ag-warning: #d29922;
      --ag-error: #f85149;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      min-height: 100vh;
      padding: 20px 24px;
      line-height: 1.5;
    }

    /* Header */
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 16px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.35));
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .header-icon {
      font-size: 20px;
      opacity: 0.9;
    }

    .header h1 {
      font-size: 16px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      letter-spacing: 0.3px;
    }

    .header .subtitle {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
    }

    /* Stats Overview */
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      border-radius: 6px;
      padding: 16px;
      text-align: center;
      transition: border-color 0.15s ease, background 0.15s ease;
    }

    .stat-card:hover {
      border-color: var(--vscode-focusBorder, var(--ag-accent));
      background: var(--ag-accent-soft);
    }

    .stat-value {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.2;
      color: var(--vscode-editor-foreground);
    }

    .stat-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }

    .stat-card.health-excellent .stat-value { color: var(--ag-success); }
    .stat-card.health-good .stat-value { color: var(--ag-accent); }
    .stat-card.health-low .stat-value { color: var(--ag-warning); }
    .stat-card.health-critical .stat-value { color: var(--ag-error); }

    /* Section Headers */
    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-title::after {
      content: '';
      flex: 1;
      height: 1px;
      background: var(--vscode-panel-border, rgba(128,128,128,0.2));
    }

    /* Models Grid */
    .models-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 24px;
    }

    .model-card {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      border-radius: 6px;
      padding: 16px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    .model-card:hover {
      border-color: var(--vscode-focusBorder, var(--ag-accent));
    }

    .model-card.active {
      border-left: 3px solid var(--ag-accent);
      background: var(--ag-accent-soft);
    }

    .model-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .model-name {
      font-size: 13px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .model-name .active-badge {
      font-size: 9px;
      padding: 2px 6px;
      background: var(--ag-accent);
      color: white;
      border-radius: 3px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .model-percent {
      font-size: 20px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
    }

    /* Progress Bar */
    .progress-container {
      margin-bottom: 12px;
    }

    .progress-bar {
      height: 6px;
      background: var(--vscode-progressBar-background, rgba(128,128,128,0.2));
      border-radius: 3px;
      overflow: hidden;
      opacity: 0.3;
    }

    .progress-bar .fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.4s ease;
    }

    .progress-bar .fill.excellent { background: var(--ag-success); }
    .progress-bar .fill.good { background: var(--ag-accent); }
    .progress-bar .fill.low { background: var(--ag-warning); }
    .progress-bar .fill.critical { background: var(--ag-error); }

    /* Model Stats */
    .model-stats {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
    }

    .model-stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .model-stat .label {
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #888);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .model-stat .value {
      font-size: 12px;
      color: var(--vscode-editor-foreground);
    }

    /* Credits Section */
    .credits-section {
      background: var(--vscode-sideBar-background, var(--vscode-editor-background));
      border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.2));
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .credits-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .credits-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .credits-value {
      font-size: 13px;
      font-weight: 600;
    }

    .credits-bar {
      height: 4px;
      background: rgba(128,128,128,0.2);
      border-radius: 2px;
      overflow: hidden;
    }

    .credits-bar .fill {
      height: 100%;
      background: var(--ag-accent);
      border-radius: 2px;
      transition: width 0.4s ease;
    }

    /* Footer */
    .footer {
      text-align: center;
      font-size: 10px;
      color: var(--vscode-descriptionForeground, #666);
      opacity: 0.7;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <span class="header-icon">⚡</span>
      <h1>Antigravity Usage</h1>
    </div>
    <span class="subtitle">Synced ${snapshot.timestamp.toLocaleTimeString()}</span>
  </div>

  <div class="stats-row">
    <div class="stat-card ${this.getHealthClass(snapshot.healthLabel)}">
      <div class="stat-value">${snapshot.overallHealth}%</div>
      <div class="stat-label">Health</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${snapshot.totalSessionUsage}%</div>
      <div class="stat-label">Session</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${snapshot.modelsWithInsights.length}</div>
      <div class="stat-label">Models</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${this.getSessionDuration(snapshot.sessionStartTime)}</div>
      <div class="stat-label">Uptime</div>
    </div>
  </div>

  <h2 class="section-title">Model Quotas</h2>
  <div class="models-grid">
    ${modelsHtml}
  </div>

  ${creditsHtml}

  <div class="footer">Antigravity Usage by Zendevve</div>
</body>
</html>`;
  }

  private renderModelCard(model: ModelWithInsights): string {
    const activeClass = model.insights.isActive ? 'active' : '';
    const activeBadge = model.insights.isActive ? '<span class="active-badge">Active</span>' : '';
    const progressClass = this.getProgressClass(model.remainingPercent);

    return `
    <div class="model-card ${activeClass}">
      <div class="model-header">
        <div class="model-name">
          ${model.label}
          ${activeBadge}
        </div>
        <div class="model-percent">${model.remainingPercent}%</div>
      </div>
      <div class="progress-container">
        <div class="progress-bar">
          <div class="fill ${progressClass}" style="width: ${model.remainingPercent}%"></div>
        </div>
      </div>
      <div class="model-stats">
        <div class="model-stat">
          <span class="label">Burn Rate</span>
          <span class="value">${model.insights.burnRateLabel}</span>
        </div>
        <div class="model-stat">
          <span class="label">ETA</span>
          <span class="value">${model.insights.predictedExhaustionLabel || '—'}</span>
        </div>
        <div class="model-stat">
          <span class="label">Reset</span>
          <span class="value">${model.timeUntilReset || '—'}</span>
        </div>
      </div>
    </div>`;
  }

  private renderCreditsCard(credits: { available: number; monthly: number; remainingPercent: number }): string {
    return `
    <h2 class="section-title">Prompt Credits</h2>
    <div class="credits-section">
      <div class="credits-row">
        <span class="credits-label">Available</span>
        <span class="credits-value">${credits.available.toLocaleString()} / ${credits.monthly.toLocaleString()}</span>
      </div>
      <div class="credits-bar">
        <div class="fill" style="width: ${credits.remainingPercent}%"></div>
      </div>
    </div>`;
  }

  private getSessionDuration(startTime: Date): string {
    const diff = Date.now() - startTime.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h`;
    return `${mins}m`;
  }

  private getHealthClass(healthLabel: string): string {
    switch (healthLabel) {
      case 'Excellent': return 'health-excellent';
      case 'Good': return 'health-good';
      case 'Low': return 'health-low';
      case 'Critical': return 'health-critical';
      default: return '';
    }
  }

  private getProgressClass(percent: number): string {
    if (percent >= 75) return 'excellent';
    if (percent >= 50) return 'good';
    if (percent >= 25) return 'low';
    return 'critical';
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
