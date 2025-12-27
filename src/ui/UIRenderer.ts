/**
 * UI Renderer - Single Source of Truth for HTML
 *
 * Generates HTML for both Sidebar (compact) and Dashboard (full) views.
 *
 * Laws of UX Applied:
 * - Miller's Law: Chunk information into 3-5 distinct sections
 * - Serial Position Effect: Primary info at top, actions at bottom
 * - Law of Common Region: Cards and sections clearly defined
 * - Aesthetic-Usability Effect: Premium, polished visuals via DesignTokens
 * - Hick's Law: Hide complex charts/details by default
 */

import { QuotaState, EnrichedModel, HealthStatus } from '../core/types';
import { DESIGN_TOKENS_CSS, getStatusClass, getStatusColor } from './DesignTokens';
import { formatDuration, formatModelName } from '../utils/formatters';

type ViewMode = 'compact' | 'full';

export class UIRenderer {

  /**
   * Generate complete HTML for a view
   */
  public render(state: QuotaState, mode: ViewMode): string {
    const content = mode === 'compact'
      ? this.renderCompact(state)
      : this.renderFull(state);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Usage</title>
  <style>
    ${DESIGN_TOKENS_CSS}
    /* View-specific overrides */
    body {
      padding: ${mode === 'compact' ? 'var(--ag-space-3)' : 'var(--ag-space-6)'};
      max-width: ${mode === 'compact' ? '100%' : '800px'};
      margin: 0 auto;
    }
  </style>
</head>
<body>
  ${content}

  <script>
    // Simple state handling for progressive disclosure
    const vscode = acquireVsCodeApi();

    // Event delegation for Fitts's Law (easy clicks everywhere)
    document.addEventListener('click', (e) => {
      const target = e.target;
      const cmdBtn = target.closest('[data-command]');
      const toggleBtn = target.closest('[data-toggle]');

      if (cmdBtn) {
        const cmd = cmdBtn.dataset.command;
        vscode.postMessage({ command: cmd });
      }

      if (toggleBtn) {
        const id = toggleBtn.dataset.toggle;
        const el = document.getElementById(id);
        if (el) {
          const isHidden = el.style.display === 'none';
          el.style.display = isHidden ? 'block' : 'none';
          toggleBtn.classList.toggle('active', isHidden);
        }
      }
    });
  </script>
</body>
</html>`;
  }

  // ==========================================================================
  // Compact View (Sidebar)
  // Usage: Quick check, primary model focus
  // ==========================================================================

  private renderCompact(state: QuotaState): string {
    if (state.isLoading && state.models.length === 0) {
      return this.renderLoading();
    }

    if (state.error) {
      return this.renderError(state.error);
    }

    if (state.models.length === 0) {
      return this.renderEmpty();
    }

    const primary = state.models[0];
    const secondary = state.models.slice(1);

    // Miller's Law Chunking:
    // 1. Primary Model (Focus)
    // 2. Other Models (Context)
    // 3. Actions (Utility)

    return `
      <div class="ag-flex ag-flex-col ag-gap-4">

        <!-- SECTION 1: Primary Model -->
        <div class="ag-section">
          ${this.renderPrimaryCard(primary, 'compact')}
        </div>

        <!-- SECTION 2: Secondary Models -->
        ${secondary.length > 0 ? `
          <div class="ag-section">
            <div class="ag-section__header">Other Models</div>
            <div class="ag-card ag-card--compact">
              <div class="ag-model-list">
                ${secondary.map(m => this.renderModelRow(m)).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- SECTION 3: System Health & Actions -->
        <div class="ag-section">
           <div class="ag-section__header">System</div>
           <div class="ag-flex ag-justify-between ag-items-center ag-mb-3">
             <span class="ag-text-muted ag-text-xs">Health</span>
             ${this.renderHealthBadge(state.health)}
           </div>

           <div class="ag-flex ag-gap-2">
             <!-- Fitts's Law: Full width buttons in sidebar -->
             <button class="ag-btn ag-btn--secondary" style="flex: 1" data-command="refresh">
               Refresh
             </button>
             <button class="ag-btn" style="flex: 1" data-command="openDashboard">
               Dashboard
             </button>
           </div>
        </div>

      </div>
    `;
  }

  // ==========================================================================
  // Full View (Dashboard)
  // Usage: Deep dive, analysis, history
  // ==========================================================================

  private renderFull(state: QuotaState): string {
    if (state.isLoading && state.models.length === 0) return this.renderLoading();
    if (state.models.length === 0) return this.renderEmpty();

    const primary = state.models[0];
    const secondary = state.models.slice(1);

    return `
      <div class="ag-flex ag-flex-col ag-gap-6">

        <!-- Header -->
        <div class="ag-flex ag-justify-between ag-items-center">
          <h1 class="ag-text-xl ag-font-bold">Usage Dashboard</h1>
          <div class="ag-text-sm ag-text-muted">
            Last updated: ${formatModelName(state.lastUpdate.toLocaleTimeString())}
          </div>
        </div>

        <!-- SECTION 1: Primary Focus -->
        ${this.renderPrimaryCard(primary, 'full')}

        <!-- SECTION 2: Detailed Breakdown -->
        <div class="ag-section">
          <div class="ag-section__header">All Models</div>
          <div class="ag-card">
            <div class="ag-model-list">
              ${state.models.map(m => this.renderModelRow(m, true)).join('')}
            </div>
          </div>
        </div>

        <!-- SECTION 3: Credits & Health (Two Columns) -->
        <div class="ag-flex ag-gap-4" style="display: grid; grid-template-columns: 1fr 1fr;">

          <!-- Column 1: Credits -->
          <div class="ag-card">
            <div class="ag-section__header ag-mb-3">Credits</div>
            <div class="ag-flex ag-flex-col ag-gap-3">
              ${state.promptCredits ? this.renderCreditRow('Prompt Reasoning', state.promptCredits) : ''}
              ${state.flowCredits ? this.renderCreditRow('Agent Flow', state.flowCredits) : ''}
              ${!state.promptCredits && !state.flowCredits ? '<div class="ag-text-muted">No credit limits active</div>' : ''}
            </div>
          </div>

          <!-- Column 2: Health -->
          <div class="ag-card">
            <div class="ag-section__header ag-mb-3">System Health</div>
            <div class="ag-flex ag-items-center ag-gap-3 ag-mb-3">
              <div class="ag-text-2xl ag-font-bold ${this.getHealthColorClass(state.health.level)}">
                ${state.health.score}%
              </div>
              <div class="ag-flex ag-flex-col">
                <span class="ag-font-bold">${state.health.label}</span>
                <span class="ag-text-xs ag-text-muted">Overall Rating</span>
              </div>
            </div>
            <div class="ag-text-xs ag-text-muted">
              Based on consumption rate and remaining quota across active models.
            </div>
          </div>

        </div>

        <!-- Footer Actions -->
        <div class="ag-flex ag-justify-between ag-mt-4">
           <button class="ag-btn ag-btn--ghost" data-command="refresh">
             Force Refresh
           </button>
           <div class="ag-text-xs ag-text-muted">
             v1.0.0 • Antigravity
           </div>
        </div>

      </div>
    `;
  }

  // ==========================================================================
  // Components
  // ==========================================================================

  private renderPrimaryCard(model: EnrichedModel, mode: 'compact' | 'full'): string {
    const statusClass = getStatusClass(model.remainingPercent);
    const progressColor = getStatusColor(model.remainingPercent);

    return `
      <div class="ag-card ag-card--primary">
        <div class="ag-flex ag-justify-between ag-items-start ag-mb-2">
          <div>
            <div class="ag-text-xs ag-text-muted ag-mb-1">Primary Model</div>
            <div class="ag-font-bold ag-text-lg">${model.label}</div>
          </div>
          <div class="ag-text-2xl ag-font-bold ag-text-${statusClass}">
            ${model.remainingPercent}%
          </div>
        </div>

        <!-- Goal-Gradient Effect: Visual progress bar -->
        <div class="ag-progress ag-progress--large ag-mb-3">
          <div class="ag-progress__fill"
               style="width: ${model.remainingPercent}%; background-color: ${progressColor}">
          </div>
        </div>

        <div class="ag-flex ag-justify-between ag-text-xs ag-text-muted">
          <div class="ag-flex ag-items-center ag-gap-1">
            <span>Reset:</span>
            <span class="ag-fg">${model.timeUntilReset || 'Unknown'}</span>
          </div>
          ${mode === 'full' ? `
          <div class="ag-flex ag-items-center ag-gap-1">
            <span>Burn Rate:</span>
            <span class="ag-fg">${model.insights.burnRateLabel}</span>
          </div>
          ` : ''}
        </div>

        ${mode === 'full' && model.insights.predictedExhaustionLabel ? `
        <div class="ag-mt-3 ag-p-2 ag-bg-muted ag-radius-sm ag-text-xs ag-flex ag-gap-2 ag-items-center" style="background: rgba(128,128,128,0.1); border-radius: 4px;">
           <span>🔮 Prediction:</span>
           <span>Runs out <strong>${model.insights.predictedExhaustionLabel}</strong> at current pace</span>
        </div>
        ` : ''}
      </div>
    `;
  }

  private renderModelRow(model: EnrichedModel, showDetails = false): string {
    const statusClass = getStatusClass(model.remainingPercent);
    const progressColor = getStatusColor(model.remainingPercent);

    return `
      <div class="ag-model-item">
        <div class="ag-model-item__info">
          <div class="ag-flex ag-justify-between ag-items-center ag-mb-1">
            <span class="ag-model-item__name">${formatModelName(model.label)}</span>
            <span class="ag-model-item__percent ag-text-${statusClass}">${model.remainingPercent}%</span>
          </div>
          <div class="ag-progress">
            <div class="ag-progress__fill"
                 style="width: ${model.remainingPercent}%; background-color: ${progressColor}">
            </div>
          </div>
          ${showDetails ? `
          <div class="ag-flex ag-justify-between ag-mt-1 ag-text-xs ag-text-muted">
             <span>Reset: ${model.timeUntilReset || '-'}</span>
             <span>${model.insights.burnRateLabel} burn</span>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  private renderCreditRow(label: string, credit: { available: number, monthly: number }): string {
    const percent = Math.round((credit.available / credit.monthly) * 100);
    const color = getStatusColor(percent);

    return `
      <div>
        <div class="ag-flex ag-justify-between ag-text-xs ag-mb-1">
          <span>${label}</span>
          <span class="ag-font-mono">${credit.available} / ${credit.monthly}</span>
        </div>
        <div class="ag-progress">
          <div class="ag-progress__fill" style="width: ${percent}%; background-color: ${color}"></div>
        </div>
      </div>
    `;
  }

  private renderHealthBadge(health: HealthStatus): string {
    const colorClass = this.getHealthColorClass(health.level);
    return `<span class="ag-badge ${colorClass}">${health.label}</span>`;
  }

  private getHealthColorClass(level: string): string {
    switch (level) {
      case 'excellent': return 'ag-text-good'; // using text util for specific coloring if needed
      case 'good': return 'ag-text-good';
      case 'low': return 'ag-text-warn';
      case 'critical': return 'ag-text-danger';
      default: return 'ag-text-muted';
    }
  }

  private renderLoading(): string {
    return `
      <div class="ag-loading">
        <div class="ag-loading__spinner"></div>
        <div>Connecting to Antigravity...</div>
      </div>
    `;
  }

  private renderError(msg: string): string {
    return `
      <div class="ag-card" style="border-color: var(--ag-status-danger)">
        <div class="ag-text-danger ag-font-bold ag-mb-2">Connection Error</div>
        <div class="ag-text-sm ag-mb-3">${msg}</div>
        <button class="ag-btn ag-btn--secondary" data-command="refresh">Retry Connection</button>
      </div>
    `;
  }

  private renderEmpty(): string {
    return `
      <div class="ag-empty">
        <div class="ag-empty__icon">∅</div>
        <div>No usage data available</div>
      </div>
    `;
  }
}
