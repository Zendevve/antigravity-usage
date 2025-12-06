/**
 * Antigravity Usage Extension
 * Premium AI usage monitoring with unique insights.
 *
 * Features:
 * - Ring-style progress indicators (unique visual identity)
 * - Active model detection based on usage patterns
 * - Burn rate tracking and exhaustion predictions
 * - Beautiful WebView dashboard with glassmorphism design
 */

import * as vscode from 'vscode';
import { QuotaService } from './quotaService';
import { StatusBarManager } from './statusBar';
import { PortDetector } from './portDetector';
import { InsightsService } from './insights';
import { DashboardPanel } from './webviewPanel';

let intervalId: NodeJS.Timeout | undefined;
let quotaService: QuotaService;
let statusBarManager: StatusBarManager;
let portDetector: PortDetector;
let insightsService: InsightsService;

export async function activate(context: vscode.ExtensionContext) {
  console.log('⚡ Antigravity Usage is starting...');

  // Initialize services
  quotaService = new QuotaService();
  statusBarManager = new StatusBarManager();
  portDetector = new PortDetector();
  insightsService = new InsightsService();

  // Command: Show Dashboard (main action)
  const dashboardCommand = vscode.commands.registerCommand('antigravity-quota.showDashboard', async () => {
    const snapshot = statusBarManager.getSnapshot();
    if (snapshot) {
      const panel = DashboardPanel.createOrShow(context.extensionUri);
      panel.update(snapshot);
    } else {
      // No data yet, try to fetch
      await detectAndPoll();
      const newSnapshot = statusBarManager.getSnapshot();
      if (newSnapshot) {
        const panel = DashboardPanel.createOrShow(context.extensionUri);
        panel.update(newSnapshot);
      } else {
        vscode.window.showWarningMessage('No quota data available yet. Please wait...');
      }
    }
  });

  // Command: Show QuickPick Menu (legacy, for those who prefer it)
  const menuCommand = vscode.commands.registerCommand('antigravity-quota.showMenu', async () => {
    const snapshot = statusBarManager.getSnapshot();
    if (!snapshot) {
      vscode.window.showWarningMessage('No quota data available');
      return;
    }

    const items = snapshot.modelsWithInsights.map(m => ({
      label: `${m.insights.isActive ? '▶ ' : '  '}${m.label}`,
      description: `${m.remainingPercent}% remaining`,
      detail: m.insights.isActive
        ? `⚡ Active | Burn: ${m.insights.burnRateLabel} | ETA: ${m.insights.predictedExhaustionLabel}`
        : `Burn: ${m.insights.burnRateLabel} | ETA: ${m.insights.predictedExhaustionLabel}`,
    }));

    // Add header with overall health
    items.unshift({
      label: `📊 Overall Health: ${snapshot.overallHealth}% (${snapshot.healthLabel})`,
      description: `Session: ${snapshot.totalSessionUsage}% used`,
      detail: ''
    });

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Antigravity Usage - Click a model or open full dashboard',
      title: '⚡ Antigravity Usage'
    });
  });

  // Command: Refresh quota
  const refreshCommand = vscode.commands.registerCommand('antigravity-quota.refresh', async () => {
    statusBarManager.showFetching();
    await pollAndUpdate();
  });

  // Command: Re-detect port
  const detectCommand = vscode.commands.registerCommand('antigravity-quota.detectPort', async () => {
    vscode.window.showInformationMessage('Re-detecting Antigravity port...');
    await detectAndPoll();
  });

  context.subscriptions.push(statusBarManager);
  context.subscriptions.push(dashboardCommand);
  context.subscriptions.push(menuCommand);
  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(detectCommand);

  // Initial detection and polling
  await detectAndPoll();

  // Start polling loop (every 60 seconds)
  intervalId = setInterval(async () => {
    await pollAndUpdate();
  }, 60 * 1000);
}

async function detectAndPoll() {
  statusBarManager.showDetecting();

  try {
    const result = await portDetector.detect();

    if (result) {
      quotaService.setConnection(result.connectPort, result.csrfToken);
      console.log(`⚡ AntiGravity detected! Port: ${result.connectPort}`);

      await pollAndUpdate();
    } else {
      statusBarManager.showError('Port detection failed');
      vscode.window.showWarningMessage(
        'Antigravity Usage: Could not detect Antigravity process.',
        'Retry'
      ).then(action => {
        if (action === 'Retry') {
          detectAndPoll();
        }
      });
    }
  } catch (error: any) {
    console.error('Detection error:', error);
    statusBarManager.showError(error.message);
  }
}

async function pollAndUpdate() {
  try {
    const quotas = await quotaService.poll();

    if (quotas.length > 0) {
      // Get full snapshot and enrich with insights
      const rawSnapshot = quotaService.getSnapshot();
      if (rawSnapshot) {
        const enrichedSnapshot = insightsService.analyze(rawSnapshot);
        statusBarManager.updateWithInsights(enrichedSnapshot);

        // Also update dashboard if open
        if (DashboardPanel.currentPanel) {
          DashboardPanel.currentPanel.update(enrichedSnapshot);
        }
      } else {
        statusBarManager.update(quotas);
      }
    } else {
      statusBarManager.showError('No quota data received');
    }
  } catch (error: any) {
    console.error('Poll error:', error);
    statusBarManager.showError(error.message);
  }
}

export function deactivate() {
  if (intervalId) {
    clearInterval(intervalId);
  }
}
