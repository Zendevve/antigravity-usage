/**
 * Antigravity Usage Extension
 * Minimal, content-first AI quota monitoring.
 *
 * Features:
 * - Clean status bar display
 * - Usage history tracking with sparklines
 * - Configurable low-quota warnings
 * - Native VS Code dashboard
 */

import * as vscode from 'vscode';
import { QuotaService } from './quotaService';
import { StatusBarManager } from './statusBar';
import { PortDetector } from './portDetector';
import { InsightsService } from './insights';
import { DashboardPanel } from './webviewPanel';
import { QuotaViewProvider } from './webviewView';
import { CacheService } from './cacheService';

let intervalId: NodeJS.Timeout | undefined;
let quotaService: QuotaService;
let statusBarManager: StatusBarManager;
let portDetector: PortDetector;
let insightsService: InsightsService;
let quotaProvider: QuotaViewProvider;
let cacheService: CacheService;

// Track which models have already triggered a warning (avoid spam)
const warnedModels: Set<string> = new Set();

// Get configuration values
function getConfig() {
  const config = vscode.workspace.getConfiguration('antigravity');
  return {
    warningThreshold: config.get<number>('warningThreshold', 25),
    refreshInterval: config.get<number>('refreshInterval', 60),
    pinnedModels: config.get<string[]>('pinnedModels', [])
  };
}

export async function activate(context: vscode.ExtensionContext) {
  console.log('Antigravity Usage starting...');

  // Initialize services
  quotaService = new QuotaService();
  statusBarManager = new StatusBarManager();
  portDetector = new PortDetector();
  insightsService = new InsightsService(context.globalState);
  cacheService = new CacheService();

  // Register Sidebar View Provider
  quotaProvider = new QuotaViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(QuotaViewProvider.viewType, quotaProvider)
  );

  // Command: Show Dashboard
  const dashboardCommand = vscode.commands.registerCommand('antigravity-quota.showDashboard', async () => {
    const snapshot = statusBarManager.getSnapshot();
    if (snapshot) {
      const panel = DashboardPanel.createOrShow(context.extensionUri);
      panel.update(snapshot);
    } else {
      await detectAndPoll();
      const newSnapshot = statusBarManager.getSnapshot();
      if (newSnapshot) {
        const panel = DashboardPanel.createOrShow(context.extensionUri);
        panel.update(newSnapshot);
      } else {
        vscode.window.showWarningMessage('No quota data available yet.');
      }
    }
  });

  // Command: Quick Status Menu
  const menuCommand = vscode.commands.registerCommand('antigravity-quota.showMenu', async () => {
    const snapshot = statusBarManager.getSnapshot();
    if (!snapshot) {
      vscode.window.showWarningMessage('No quota data available');
      return;
    }

    const items = snapshot.modelsWithInsights.map(m => ({
      label: `${m.insights.isActive ? '› ' : '  '}${m.label}`,
      description: `${m.remainingPercent}%`,
      detail: `Burn: ${m.insights.burnRateLabel} · ETA: ${m.insights.predictedExhaustionLabel || '—'}`,
    }));

    await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a model for details',
      title: 'Quota Status'
    });
  });

  // Command: Refresh
  const refreshCommand = vscode.commands.registerCommand('antigravity-quota.refresh', async () => {
    statusBarManager.showFetching();
    await pollAndUpdate();
  });

  // Command: Re-detect port
  const detectCommand = vscode.commands.registerCommand('antigravity-quota.detectPort', async () => {
    vscode.window.showInformationMessage('Re-detecting Antigravity...');
    await detectAndPoll();
  });

  // Command: Pin Model
  const pinCommand = vscode.commands.registerCommand('antigravity-quota.pinModel', async () => {
    const rawSnapshot = quotaService.getSnapshot();
    if (!rawSnapshot || rawSnapshot.models.length === 0) {
      vscode.window.showWarningMessage('No models found to pin.');
      return;
    }

    const { pinnedModels } = getConfig();
    // Filter out already pinned models
    const available = rawSnapshot.models
      .filter(m => !pinnedModels.includes(m.label)) // Exact match check for simplicity
      .map(m => m.label);

    if (available.length === 0) {
      vscode.window.showInformationMessage('All visible models are already pinned.');
      return;
    }

    const selected = await vscode.window.showQuickPick(available, {
      placeHolder: 'Select model to pin'
    });

    if (selected) {
      const config = vscode.workspace.getConfiguration('antigravity');
      const newPinned = [...pinnedModels, selected];
      await config.update('pinnedModels', newPinned, vscode.ConfigurationTarget.Global);
      // Polling will pick up the change automatically via onDidChangeConfiguration -> getConfig()
      vscode.window.showInformationMessage(`Pinned ${selected}`);
      await pollAndUpdate(); // Force immediate update
    }
  });

  // Command: Unpin Model
  const unpinCommand = vscode.commands.registerCommand('antigravity-quota.unpinModel', async () => {
    const { pinnedModels } = getConfig();
    if (pinnedModels.length === 0) {
      vscode.window.showInformationMessage('No models are currently pinned.');
      return;
    }

    const selected = await vscode.window.showQuickPick(pinnedModels, {
      placeHolder: 'Select model to unpin'
    });

    if (selected) {
      const config = vscode.workspace.getConfiguration('antigravity');
      const newPinned = pinnedModels.filter(m => m !== selected);
      await config.update('pinnedModels', newPinned, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage(`Unpinned ${selected}`);
      await pollAndUpdate(); // Force immediate update
    }
  });

  // Command: Clean Cache
  const cleanCacheCommand = vscode.commands.registerCommand('antigravity-quota.cleanCache', async () => {
    const info = await cacheService.getCacheInfo();
    const size = (info.totalSize / 1024 / 1024).toFixed(2);

    const answer = await vscode.window.showWarningMessage(
      `Clean ${size} MB of Antigravity cache? This will delete all Brain tasks and conversation history.`,
      { modal: true },
      'Clean All'
    );

    if (answer === 'Clean All') {
      await cacheService.cleanCache();
      vscode.window.showInformationMessage('Cache cleaned.');
    }
  });

  // Command: Manage Cache
  const manageCacheCommand = vscode.commands.registerCommand('antigravity-quota.manageCache', async () => {
    const info = await cacheService.getCacheInfo();
    if (info.brainTasks.length === 0) {
      vscode.window.showInformationMessage('No Brain tasks found.');
      return;
    }

    const items = info.brainTasks.map(t => ({
      label: t.label || t.id,
      description: `Task ${t.id.substring(0, 8)}...`,
      detail: `${(t.size / 1024).toFixed(1)} KB · ${t.fileCount} files · ${new Date(t.createdAt).toLocaleDateString()}`,
      taskId: t.id
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a task to delete',
      title: 'Manage Brain Tasks'
    });

    if (selected) {
      const confirm = await vscode.window.showWarningMessage(
        `Permanently delete "${selected.label}"?`,
        { modal: true },
        'Delete'
      );

      if (confirm === 'Delete') {
        await cacheService.deleteTask(selected.taskId);
        vscode.window.showInformationMessage(`Deleted task ${selected.label}`);
      }
    }
  });
  context.subscriptions.push(statusBarManager);
  context.subscriptions.push(dashboardCommand);
  context.subscriptions.push(menuCommand);
  context.subscriptions.push(refreshCommand);
  context.subscriptions.push(detectCommand);
  context.subscriptions.push(pinCommand);
  context.subscriptions.push(unpinCommand);
  context.subscriptions.push(cleanCacheCommand);
  context.subscriptions.push(manageCacheCommand);

  // Listen for config changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('antigravity.refreshInterval')) {
        restartPolling();
      }
    })
  );

  // Initial detection
  await detectAndPoll();

  // Start polling with configured interval
  startPolling();
}

function startPolling() {
  const { refreshInterval } = getConfig();
  intervalId = setInterval(async () => {
    await pollAndUpdate();
  }, refreshInterval * 1000);
}

function restartPolling() {
  if (intervalId) {
    clearInterval(intervalId);
  }
  startPolling();
}

async function detectAndPoll() {
  statusBarManager.showDetecting();

  try {
    const result = await portDetector.detect();

    if (result) {
      quotaService.setConnection(result.connectPort, result.csrfToken);
      console.log(`Antigravity detected on port ${result.connectPort}`);
      await pollAndUpdate();
    } else {
      statusBarManager.showError('Detection failed');
      vscode.window.showWarningMessage(
        'Could not detect Antigravity process.',
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
      const rawSnapshot = quotaService.getSnapshot();
      if (rawSnapshot) {
        const { pinnedModels } = getConfig();
        const enrichedSnapshot = insightsService.analyze(rawSnapshot, pinnedModels);
        statusBarManager.updateWithInsights(enrichedSnapshot);

        // Check for low quota warnings
        checkQuotaWarnings(enrichedSnapshot);

        // Update dashboard if open
        if (DashboardPanel.currentPanel) {
          DashboardPanel.currentPanel.update(enrichedSnapshot);
        }
        if (quotaProvider) {
          const cacheInfo = await cacheService.getCacheInfo();
          quotaProvider.update(enrichedSnapshot, cacheInfo);
        }
      } else {
        statusBarManager.update(quotas);
      }
    } else {
      statusBarManager.showError('No quota data');
    }
  } catch (error: any) {
    console.error('Poll error:', error);
    statusBarManager.showError(error.message);
  }
}

function checkQuotaWarnings(snapshot: { modelsWithInsights: Array<{ modelId: string; label: string; remainingPercent: number }> }) {
  const { warningThreshold } = getConfig();

  for (const model of snapshot.modelsWithInsights) {
    const wasWarned = warnedModels.has(model.modelId);

    if (model.remainingPercent < warningThreshold) {
      if (!wasWarned) {
        // First time crossing threshold - show warning
        warnedModels.add(model.modelId);
        vscode.window.showWarningMessage(
          `${model.label} is at ${model.remainingPercent}%`,
          'Open Dashboard'
        ).then(action => {
          if (action === 'Open Dashboard') {
            vscode.commands.executeCommand('antigravity-quota.showDashboard');
          }
        });
      }
    } else if (wasWarned && model.remainingPercent >= warningThreshold + 5) {
      // Recovered above threshold + buffer - reset warning state
      warnedModels.delete(model.modelId);
    }
  }
}

export function deactivate() {
  if (intervalId) {
    clearInterval(intervalId);
  }
}
