/**
 * Sidebar View Provider - Optimized for Sidebar
 * Uses the compact "Mini" version of the dashboard.
 */

import * as vscode from 'vscode';
import { SnapshotWithInsights } from './insights';
import { CacheInfo } from './cacheService';
import { buildCUStatsSidebar } from './custatsSidebar';

export class QuotaViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'antigravity-usage.quotaView';

  private _view?: vscode.WebviewView;
  private lastSnapshot?: SnapshotWithInsights;
  private lastCacheInfo?: CacheInfo;
  private _isInitialized = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
  ) { }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    this._isInitialized = false;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.onDidReceiveMessage(data => {
      switch (data.command) {
        case 'openDashboard':
          vscode.commands.executeCommand('antigravity-quota.openDashboard');
          break;
        case 'refresh':
          vscode.commands.executeCommand('antigravity-quota.refresh');
          break;
      }
    });

    if (this.lastSnapshot) {
      this.update(this.lastSnapshot, this.lastCacheInfo);
    }
  }

  public update(snapshot: SnapshotWithInsights, cacheInfo?: CacheInfo) {
    this.lastSnapshot = snapshot;
    if (cacheInfo) {
      this.lastCacheInfo = cacheInfo;
    }

    if (this._view && this._view.webview) {
      const state = {
        snapshot: this.lastSnapshot,
        cacheInfo: this.lastCacheInfo
      };

      if (this._isInitialized) {
        this._view.webview.postMessage({ command: 'update', data: state });
      } else {
        this._view.webview.html = buildCUStatsSidebar(snapshot, this.lastCacheInfo);
        this._isInitialized = true;
      }
    }
  }
}
