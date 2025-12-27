"use strict";
/**
 * Sidebar View Provider - Optimized for Sidebar
 * Uses the compact "Mini" version of the dashboard.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QuotaViewProvider = void 0;
const vscode = require("vscode");
const custatsSidebar_1 = require("./custatsSidebar");
class QuotaViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
        this._isInitialized = false;
    }
    resolveWebviewView(webviewView, context, _token) {
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
    update(snapshot, cacheInfo) {
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
            }
            else {
                this._view.webview.html = (0, custatsSidebar_1.buildCUStatsSidebar)(snapshot, this.lastCacheInfo);
                this._isInitialized = true;
            }
        }
    }
}
exports.QuotaViewProvider = QuotaViewProvider;
QuotaViewProvider.viewType = 'antigravity-usage.quotaView';
//# sourceMappingURL=webviewView.js.map