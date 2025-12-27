/**
 * WebView Manager - Unified UI Controller
 *
 * Manages both Sidebar and Dashboard webviews.
 * Bridges the gap between VS Code extension context and the UI Renderer.
 *
 * Laws of UX Applied:
 * - Doherty Threshold: Fast updates via single message channel
 * - Jakob's Law: Standard VS Code webview behaviors
 */

import * as vscode from 'vscode';
import { QuotaStore } from '../core/QuotaStore';
import { UIRenderer } from './UIRenderer';
import { QuotaState } from '../core/types';

export class WebViewManager implements vscode.WebviewViewProvider {
  public static readonly SIDEBAR_ID = 'antigravity.quotaView';

  private sidebarView?: vscode.WebviewView;
  private dashboardPanel?: vscode.WebviewPanel;
  private renderer: UIRenderer;
  private unsubscribe: () => void;

  constructor(
    private context: vscode.ExtensionContext,
    private store: QuotaStore
  ) {
    this.renderer = new UIRenderer();

    // Subscribe to state changes to auto-update views
    this.unsubscribe = this.store.subscribe((state) => this.updateAll(state));

    // Register sidebar provider
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        WebViewManager.SIDEBAR_ID,
        this
      )
    );
  }

  // ==========================================================================
  // Sidebar Implementation (WebviewViewProvider)
  // ==========================================================================

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this.sidebarView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    webviewView.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    // Initial Render
    this.updateSidebar(this.store.getState());
  }

  // ==========================================================================
  // Dashboard Implementation (WebviewPanel)
  // ==========================================================================

  public openDashboard() {
    if (this.dashboardPanel) {
      this.dashboardPanel.reveal();
      return;
    }

    this.dashboardPanel = vscode.window.createWebviewPanel(
      'antigravity.dashboard',
      'Antigravity Usage',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [this.context.extensionUri],
        retainContextWhenHidden: true // Optimize performance (Doherty Threshold)
      }
    );

    this.dashboardPanel.onDidDispose(() => {
      this.dashboardPanel = undefined;
    }, null, this.context.subscriptions);

    this.dashboardPanel.webview.onDidReceiveMessage(this.handleMessage.bind(this));

    // Initial Render
    this.updateDashboard(this.store.getState());
  }

  // ==========================================================================
  // Updates & Messaging
  // ==========================================================================

  private updateAll(state: QuotaState) {
    this.updateSidebar(state);
    this.updateDashboard(state);
  }

  private updateSidebar(state: QuotaState) {
    if (this.sidebarView) {
      this.sidebarView.webview.html = this.renderer.render(state, 'compact');
    }
  }

  private updateDashboard(state: QuotaState) {
    if (this.dashboardPanel) {
      this.dashboardPanel.webview.html = this.renderer.render(state, 'full');
    }
  }

  private handleMessage(message: any) {
    switch (message.command) {
      case 'refresh':
        vscode.commands.executeCommand('antigravity.refreshQuota');
        break;
      case 'openDashboard':
        vscode.commands.executeCommand('antigravity.openDashboard');
        break;
    }
  }

  public dispose() {
    this.unsubscribe();
    this.dashboardPanel?.dispose();
  }
}
