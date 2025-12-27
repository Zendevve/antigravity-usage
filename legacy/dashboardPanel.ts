import * as vscode from 'vscode';
import { SnapshotWithInsights } from './insights';
import { CacheInfo } from './cacheService';
import { buildCUStatsDashboard } from './custatsDashboard';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private _lastSnapshot: SnapshotWithInsights | undefined;
  private _lastCacheInfo: CacheInfo | undefined;
  private _isInitialized = false;

  public static createOrShow(extensionUri: vscode.Uri, snapshot?: SnapshotWithInsights, cacheInfo?: CacheInfo) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it.
    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      if (snapshot) {
        DashboardPanel.currentPanel.update(snapshot, cacheInfo);
      }
      return;
    }

    // Otherwise, create a new panel.
    const panel = vscode.window.createWebviewPanel(
      'antigravityUsageDashboard',
      'Antigravity Usage',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri]
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri);
    if (snapshot) {
      DashboardPanel.currentPanel.update(snapshot, cacheInfo);
    }
  }

  private _showInsights = false;

  public update(snapshot: SnapshotWithInsights, cacheInfo?: CacheInfo) {
    this._lastSnapshot = snapshot;
    if (cacheInfo) this._lastCacheInfo = cacheInfo;

    const state = {
      snapshot: this._lastSnapshot,
      cacheInfo: this._lastCacheInfo,
      showInsights: this._showInsights
    };

    if (this._isInitialized) {
      this._panel.webview.postMessage({ command: 'update', data: state });
    } else {
      this._panel.webview.html = buildCUStatsDashboard(snapshot, this._lastCacheInfo, this._showInsights);
      this._isInitialized = true;
    }
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refresh':
            vscode.commands.executeCommand('antigravity-quota.refresh');
            break;
          case 'toggleInsights':
            this._showInsights = !this._showInsights;
            if (this._lastSnapshot) {
              // Just send an update with the new showInsights flag
              this.update(this._lastSnapshot, this._lastCacheInfo);
            }
            break;
          case 'cleanCache':
            vscode.commands.executeCommand('antigravity-quota.cleanCache');
            break;
          case 'manageCache':
            vscode.commands.executeCommand('antigravity-quota.manageCache');
            break;
        }
      },
      null,
      this._disposables
    );
  }

  public dispose() {
    DashboardPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
}
