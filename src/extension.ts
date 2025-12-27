/**
 * Antigravity Usage V2 - Extension Entry Point
 *
 * Thin orchestrator that wires up the core architecture.
 *
 * Laws of UX Applied:
 * - Occam's Razor: Minimal complexity in the entry point
 */

import * as vscode from 'vscode';
import { getStore, resetStore, QuotaConfig } from './core/index';
import { QuotaFetcher } from './core/QuotaFetcher';
import { InsightsEngine } from './core/InsightsEngine';
import { StatusBarView } from './ui/StatusBarView';
import { WebViewManager } from './ui/WebViewManager';

// ============================================================================
// Globals
// ============================================================================

let fetcher: QuotaFetcher;
let insights: InsightsEngine;
let statusBar: StatusBarView;
let webViewManager: WebViewManager;
let pollingInterval: NodeJS.Timeout | undefined;

// ============================================================================
// Activation
// ============================================================================

export async function activate(context: vscode.ExtensionContext) {
  console.log('[Antigravity Usage] V2 Activation Starting...');

  // 1. Initialize Core Services
  resetStore(); // Ensure fresh state
  const store = getStore();

  fetcher = new QuotaFetcher();
  insights = new InsightsEngine(context.globalState);

  // 2. Initialize UI Components
  statusBar = new StatusBarView(store);
  webViewManager = new WebViewManager(context, store);
  context.subscriptions.push(statusBar, webViewManager);

  // 3. Register Commands
  registerCommands(context);

  // 4. Start Polling Loop
  startPolling();

  // 5. Watch for Config Changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('antigravity')) {
        console.log('[Antigravity Usage] Configuration changed, reloading...');
        startPolling(); // Restart with new interval
        poll(); // Trigger immediate update
      }
    })
  );

  console.log('[Antigravity Usage] V2 Activated successfully');
}

// ============================================================================
// Deactivation
// ============================================================================

export function deactivate() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function registerCommands(context: vscode.ExtensionContext) {
  const commands = [
    {
      id: 'antigravity.refreshQuota',
      handler: async () => {
        await poll();
        vscode.window.setStatusBarMessage('$(check) Quota refreshed', 3000);
      }
    },
    {
      id: 'antigravity.openDashboard',
      handler: () => webViewManager.openDashboard()
    },
    {
      id: 'antigravity.openSidebar',
      handler: () => {
        // Focus the sidebar view
        vscode.commands.executeCommand(WebViewManager.SIDEBAR_ID);
      }
    },
    {
      id: 'antigravity.clearHistory',
      handler: async () => {
        const confirm = await vscode.window.showWarningMessage(
          'Are you sure you want to clear usage history?',
          'Yes', 'Cancel'
        );
        if (confirm === 'Yes') {
          await insights.clearHistory();
          poll();
        }
      }
    }
  ];

  for (const cmd of commands) {
    context.subscriptions.push(
      vscode.commands.registerCommand(cmd.id, cmd.handler)
    );
  }
}

function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  const config = getConfig();
  // Ensure minimum interval of 30s to respect Doherty Threshold (don't over-poll)
  // but provide timely updates
  const interval = Math.max(30, config.refreshInterval) * 1000;

  console.log(`[Antigravity Usage] Polling started (interval: ${interval}ms)`);

  // Initial poll
  poll();

  pollingInterval = setInterval(poll, interval);
}

async function poll() {
  const store = getStore();
  store.dispatch({ type: 'LOADING' });

  try {
    const rawData = await fetcher.fetch();

    if (rawData) {
      const config = getConfig();
      const result = insights.analyze(rawData.models, config);

      store.dispatch({
        type: 'UPDATE',
        payload: {
          models: result.models,
          health: result.health,
          promptCredits: rawData.promptCredits,
          flowCredits: rawData.flowCredits,
          lastUpdate: new Date()
        }
      });
    } else {
      store.dispatch({
        type: 'ERROR',
        payload: 'Could not connect to Antigravity'
      });
    }
  } catch (error: any) {
    console.error('[Antigravity Usage] Poll error:', error);
    store.dispatch({
      type: 'ERROR',
      payload: error.message || 'Unknown error during update'
    });
  }
}

function getConfig(): QuotaConfig {
  const config = vscode.workspace.getConfiguration('antigravity');
  return {
    warningThreshold: config.get('warningThreshold', 25),
    refreshInterval: config.get('refreshInterval', 60),
    pinnedModels: config.get('pinnedModels', []),
    displayStyle: config.get('displayStyle', 'percentage')
  };
}
