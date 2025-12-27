/**
 * Status Bar View
 *
 * Minimalist status bar controller.
 *
 * Laws of UX Applied:
 * - Hick's Law: Minimal choices/information to reduce cognitive load
 * - Von Restorff Effect: Color coding for critical states
 * - Fitts's Law: Easy access to full dashboard
 */

import * as vscode from 'vscode';
import { QuotaStore } from '../core/QuotaStore';
import { QuotaState } from '../core/types';
import { formatRelativeTime } from '../utils/formatters';

export class StatusBarView {
  private item: vscode.StatusBarItem;
  private unsubscribe: () => void;

  constructor(private store: QuotaStore) {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = 'antigravity.openSidebar'; // Primary action
    this.unsubscribe = () => { }; // Initial dummy
    this.subscribe();
  }

  private subscribe() {
    this.unsubscribe = this.store.subscribe((state) => this.update(state));
    // Initial update
    this.update(this.store.getState());
  }

  private update(state: QuotaState) {
    if (state.isLoading && !state.lastUpdate) {
      this.item.text = '$(sync~spin) Connecting...';
      this.item.show();
      return;
    }

    if (state.error) {
      this.item.text = '$(error) Offline';
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      this.item.tooltip = `Connection Error: ${state.error}`;
      this.item.show();
      return;
    }

    if (state.models.length === 0) {
      this.item.hide();
      return;
    }

    const primary = state.models[0];
    const percent = primary.remainingPercent;

    // Hick's Law: Simple text
    // "$(pulse)" icon animation if session is active (simulated here by high burn rate or just static icon)
    const icon = primary.insights.isActive ? '$(pulse)' : '$(check)';
    this.item.text = `${icon} ${percent}%`;

    // Von Restorff Effect: Color changes for attention
    if (percent < 25) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    } else if (percent < 50) {
      this.item.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
      this.item.backgroundColor = undefined; // Default
    }

    // Rich Tooltip (Progressive Disclosure)
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    md.appendMarkdown(`### ${primary.label}\n`);
    md.appendMarkdown(`**${percent}%** remaining\n\n`);

    if (primary.timeUntilReset) {
      md.appendMarkdown(`$(clock) Resets in **${primary.timeUntilReset}**\n`);
    }

    if (primary.insights.predictedExhaustionLabel) {
      md.appendMarkdown(`$(crystal-ball) Est. empty: **${primary.insights.predictedExhaustionLabel}**\n`);
    }

    md.appendMarkdown(`\n---\n`);
    md.appendMarkdown(`[Open Sidebar](command:antigravity.openSidebar) • [Dashboard](command:antigravity.openDashboard)`);

    this.item.tooltip = md;
    this.item.show();
  }

  public dispose() {
    this.unsubscribe();
    this.item.dispose();
  }
}
