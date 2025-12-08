/**
 * WebView Dashboard Panel - Invisible Interface Edition
 * Content-first, minimal chrome. The data is the interface.
 */

import * as vscode from 'vscode';
import { SnapshotWithInsights, ModelWithInsights } from './insights';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];
  private lastSnapshot: SnapshotWithInsights | undefined;
  private showInsights: boolean = false;

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      message => {
        if (message.command === 'toggleInsights') {
          this.showInsights = !this.showInsights;
          if (this.lastSnapshot) {
            this.update(this.lastSnapshot);
          }
        }
      },
      null,
      this.disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.ViewColumn.Two;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel.panel.reveal(column);
      return DashboardPanel.currentPanel;
    }

    const panel = vscode.window.createWebviewPanel(
      'antigravityDashboard',
      'Quota',
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
    const modelsHtml = snapshot.modelsWithInsights
      .map(model => this.renderModelRow(model))
      .join('');

    const creditsHtml = snapshot.promptCredits
      ? this.renderCredits(snapshot.promptCredits)
      : '';

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

  <div class="footer">
    <button class="toggle-btn" onclick="toggleInsights()">${insightsToggle}</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function toggleInsights() {
      vscode.postMessage({ command: 'toggleInsights' });
    }
  </script>
</body>
</html>`;
  }

  private renderModelRow(model: ModelWithInsights): string {
    const activeClass = model.insights.isActive ? 'active' : '';
    const percentClass = this.getPercentClass(model.remainingPercent);
    const reset = model.timeUntilReset || '';

    // Insights row (only shown when toggled)
    const insightsHtml = `
      <div class="model-insights">
        Burn: ${model.insights.burnRateLabel} ·
        ETA: ${model.insights.predictedExhaustionLabel || '—'}
      </div>
    `;

    return `
      <div class="model-row">
        <span class="model-name ${activeClass}">${model.label}</span>
        <div class="model-right">
          <span class="model-reset">${reset}</span>
          <span class="model-percent ${percentClass}">${model.remainingPercent}%</span>
        </div>
      </div>
      ${this.showInsights ? insightsHtml : ''}
    `;
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

  public dispose() {
    DashboardPanel.currentPanel = undefined;
    this.panel.dispose();

    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }
}
