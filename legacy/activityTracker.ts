/**
 * Activity Tracker - Event-Driven Polling
 * Monitors VS Code activity to trigger smart quota refreshes.
 *
 * Strategy:
 * - Detect user activity via document events
 * - Trigger immediate refresh after AI interactions (saves, terminal activity)
 * - Reduce polling frequency during idle periods
 * - Track Antigravity-related activity patterns
 */

import * as vscode from 'vscode';

export type ActivityLevel = 'idle' | 'low' | 'high';

export interface ActivityState {
  level: ActivityLevel;
  lastActivity: Date;
  recentSaves: number;      // Saves in last 5 minutes
  recentTerminal: number;   // Terminal actions in last 5 minutes
  suggestedInterval: number; // Milliseconds
}

export class ActivityTracker implements vscode.Disposable {
  private disposables: vscode.Disposable[] = [];
  private activityLog: Date[] = [];
  private saveLog: Date[] = [];
  private terminalLog: Date[] = [];
  private onActivityChange: ((state: ActivityState) => void) | undefined;
  private lastRefreshTrigger: Date | undefined;

  // Configuration
  private readonly IDLE_THRESHOLD_MS = 5 * 60 * 1000;     // 5 min idle
  private readonly HIGH_ACTIVITY_SAVES = 3;               // 3+ saves = high
  private readonly ACTIVITY_WINDOW_MS = 5 * 60 * 1000;    // 5 min window
  private readonly MIN_REFRESH_INTERVAL_MS = 15 * 1000;   // 15s minimum between refreshes
  private readonly DEBOUNCE_MS = 2000;                    // 2s debounce

  // Polling intervals based on activity
  private readonly INTERVALS = {
    idle: 120 * 1000,   // 2 min when idle
    low: 60 * 1000,     // 1 min for low activity
    high: 30 * 1000     // 30s for high activity
  };

  constructor() {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Document saves - strong signal of AI interaction
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument(() => {
        this.logActivity('save');
        this.saveLog.push(new Date());
        this.evaluateAndNotify();
      })
    );

    // Document changes - general activity
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) => {
        // Only count significant changes
        if (e.contentChanges.length > 0) {
          this.logActivity('edit');
        }
      })
    );

    // Terminal activity - often indicates AI task execution
    this.disposables.push(
      vscode.window.onDidOpenTerminal(() => {
        this.logActivity('terminal');
        this.terminalLog.push(new Date());
        this.evaluateAndNotify();
      })
    );

    this.disposables.push(
      vscode.window.onDidChangeActiveTerminal(() => {
        this.logActivity('terminal');
        this.terminalLog.push(new Date());
      })
    );

    // Editor focus changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.logActivity('focus');
      })
    );

    // Window state (VS Code gains/loses focus)
    this.disposables.push(
      vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
          this.logActivity('focus');
          // Trigger refresh when VS Code regains focus after being idle
          if (this.getState().level === 'idle') {
            this.evaluateAndNotify();
          }
        }
      })
    );
  }

  private logActivity(type: string) {
    this.activityLog.push(new Date());
    // Keep only last 100 entries
    if (this.activityLog.length > 100) {
      this.activityLog = this.activityLog.slice(-50);
    }
    console.log(`[ActivityTracker] ${type} activity logged`);
  }

  private evaluateAndNotify() {
    // Debounce rapid events
    if (this.lastRefreshTrigger) {
      const elapsed = Date.now() - this.lastRefreshTrigger.getTime();
      if (elapsed < this.MIN_REFRESH_INTERVAL_MS) {
        return;
      }
    }

    this.lastRefreshTrigger = new Date();

    if (this.onActivityChange) {
      const state = this.getState();
      console.log(`[ActivityTracker] Activity level: ${state.level}, interval: ${state.suggestedInterval / 1000}s`);
      this.onActivityChange(state);
    }
  }

  /**
   * Set callback for activity changes
   */
  public setActivityCallback(callback: (state: ActivityState) => void) {
    this.onActivityChange = callback;
  }

  /**
   * Get current activity state
   */
  public getState(): ActivityState {
    const now = Date.now();
    const windowStart = now - this.ACTIVITY_WINDOW_MS;

    // Count recent activity
    const recentActivity = this.activityLog.filter(d => d.getTime() > windowStart).length;
    const recentSaves = this.saveLog.filter(d => d.getTime() > windowStart).length;
    const recentTerminal = this.terminalLog.filter(d => d.getTime() > windowStart).length;

    // Determine activity level
    let level: ActivityLevel;
    let suggestedInterval: number;

    const lastActivityTime = this.activityLog.length > 0
      ? this.activityLog[this.activityLog.length - 1].getTime()
      : 0;
    const timeSinceActivity = now - lastActivityTime;

    if (timeSinceActivity > this.IDLE_THRESHOLD_MS) {
      level = 'idle';
      suggestedInterval = this.INTERVALS.idle;
    } else if (recentSaves >= this.HIGH_ACTIVITY_SAVES || recentTerminal >= 2) {
      level = 'high';
      suggestedInterval = this.INTERVALS.high;
    } else {
      level = 'low';
      suggestedInterval = this.INTERVALS.low;
    }

    return {
      level,
      lastActivity: new Date(lastActivityTime),
      recentSaves,
      recentTerminal,
      suggestedInterval
    };
  }

  /**
   * Check if we should trigger an immediate refresh
   * (useful after document save during active AI session)
   */
  public shouldTriggerImmediateRefresh(): boolean {
    const now = Date.now();
    const recentSave = this.saveLog.filter(d => now - d.getTime() < this.DEBOUNCE_MS).length > 0;

    if (!recentSave) return false;
    if (!this.lastRefreshTrigger) return true;

    return (now - this.lastRefreshTrigger.getTime()) > this.MIN_REFRESH_INTERVAL_MS;
  }

  /**
   * Force-mark that a refresh is happening now
   */
  public markRefresh() {
    this.lastRefreshTrigger = new Date();
  }

  /**
   * Clean up old logs periodically
   */
  public cleanup() {
    const cutoff = Date.now() - this.ACTIVITY_WINDOW_MS * 2;
    this.saveLog = this.saveLog.filter(d => d.getTime() > cutoff);
    this.terminalLog = this.terminalLog.filter(d => d.getTime() > cutoff);
  }

  public dispose() {
    this.disposables.forEach(d => d.dispose());
  }
}
