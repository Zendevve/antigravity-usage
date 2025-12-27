/**
 * CUStats-Style Mini Sidebar Builder
 * A compact, summary version of the dashboard optimized for the sidebar.
 * Uses Client-Side Rendering (CSR) and Shared Shadcn Design System.
 */

import { SnapshotWithInsights } from './insights';
import { CacheInfo } from './cacheService';
import { SHADCN_CSS } from './designSystem';

export function buildCUStatsSidebar(
  snapshot: SnapshotWithInsights,
  cacheInfo?: CacheInfo
): string {
  const initialData = JSON.stringify({ snapshot, cacheInfo });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quota Sidebar</title>
  <style>
    ${SHADCN_CSS}
    /* Sidebar Specific Overrides */
    body { padding: 0.75rem; background: transparent; }
    .card { background: var(--vscode-sideBar-background); } /* Match sidebar bg */
  </style>
</head>
<body class="preload">
  <div class="flex flex-col gap-4">

    <!-- Primary Model Card -->
    <div id="primary-card" class="card p-4 flex flex-col items-center text-center relative overflow-hidden">
      <!-- Glow Line -->
      <div id="glow-line" class="absolute top-0 left-0 w-full h-[2px] bg-primary shadow-[0_0_10px_var(--primary)]"></div>

      <div id="live-badge" class="badge badge-good mb-2" style="display: none;">
        <span class="w-1.5 h-1.5 rounded-full bg-current mr-1 animate-pulse"></span> LIVE
      </div>

      <div id="primary-name" class="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">--</div>
      <div id="primary-percent" class="text-4xl font-bold tracking-tighter leading-none mb-2">--%</div>
      <div id="primary-status" class="badge badge-outline text-xs">--</div>

      <div id="primary-burn-container" class="mt-2 text-xs text-muted-foreground" style="display: none;">
        Burn: <span id="primary-burn" class="font-mono">--</span>
      </div>
    </div>

    <!-- Other Models List -->
    <div id="other-models-container" style="display: none;">
      <div class="text-xs font-semibold text-muted-foreground uppercase mb-2 px-1">Other Models</div>
      <div id="other-models-list" class="flex flex-col gap-2">
        <!-- Injected -->
      </div>
    </div>

    <!-- Reset Timer -->
    <div id="reset-timer-container" class="text-center text-xs text-muted-foreground" style="display: none;">
      Resets in <span id="reset-timer-display" class="font-mono font-medium text-foreground">--:--:--</span>
    </div>

    <button class="button button-primary w-full" onclick="openDashboard()">
      Open Full Dashboard
    </button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentState = ${initialData};

    window.addEventListener('load', () => {
      document.body.classList.remove('preload');
      if (currentState) render(currentState);
    });

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.command === 'update') {
        currentState = message.data;
        render(currentState);
      }
    });

    function openDashboard() { vscode.postMessage({ command: 'openDashboard' }); }

    function render(state) {
      if (!state || !state.snapshot) return;
      const snap = state.snapshot;
      const primary = snap.modelsWithInsights.find(m => m.insights.isActive) || snap.modelsWithInsights[0];
      const primaryPercent = primary ? primary.remainingPercent : 100;
      const status = getStatus(primaryPercent);

      // Primary Card
      const liveBadge = document.getElementById('live-badge');
      liveBadge.style.display = (primary && primary.insights.isActive) ? 'inline-flex' : 'none';

      setText('primary-name', primary ? primary.label : 'Idle');
      setText('primary-percent', primaryPercent + '%');

      const pctEl = document.getElementById('primary-percent');
      pctEl.style.color = getStatusColor(primaryPercent);

      // Update top glow line color
      const glow = document.getElementById('glow-line');
      glow.style.backgroundColor = getStatusColor(primaryPercent);
      glow.style.boxShadow = \`0 0 10px \${getStatusColor(primaryPercent)}\`;

      const statusBadge = document.getElementById('primary-status');
      statusBadge.textContent = getStatusLabel(primaryPercent);
      statusBadge.className = \`badge badge-\${status}\`;

      const burnContainer = document.getElementById('primary-burn-container');
      if (primary && primary.insights.isActive) {
        burnContainer.style.display = 'block';
        setText('primary-burn', primary.insights.burnRateLabel);
      } else {
        burnContainer.style.display = 'none';
      }

      // Other Models
      const otherModels = snap.modelsWithInsights.filter(m => m.label !== (primary ? primary.label : ''));
      const othersContainer = document.getElementById('other-models-container');
      if (otherModels.length > 0) {
        othersContainer.style.display = 'block';
        const list = document.getElementById('other-models-list');
        list.innerHTML = otherModels.map(m => \`
          <div class="flex items-center justify-between p-2 rounded bg-secondary/30 hover:bg-secondary/50 transition-colors border border-transparent">
            <span class="text-xs font-medium">\${m.label.split(' ')[0]}</span>
            <span class="text-xs font-bold" style="color: \${getStatusColor(m.remainingPercent)}">\${m.remainingPercent}%</span>
          </div>
        \`).join('');
      } else {
        othersContainer.style.display = 'none';
      }

      // Timer
      const timerContainer = document.getElementById('reset-timer-container');
      const timerDisplay = document.getElementById('reset-timer-display');

      if (primary && primary.resetTime) {
        timerContainer.style.display = 'block';
        timerDisplay.setAttribute('data-target', new Date(primary.resetTime).getTime());
        updateTimerOnce(timerDisplay);
      } else {
        timerContainer.style.display = 'none';
      }
    }

    function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
    function getStatus(p) { if(p < 15) return 'danger'; if(p < 40) return 'warning'; return 'good'; }
    function getStatusColor(p) { if(p < 15) return 'var(--destructive)'; if(p < 40) return 'var(--vscode-editorWarning-foreground)'; return 'var(--vscode-testing-iconPassed)'; }
    function getStatusLabel(p) { if(p < 15) return 'Critical'; if(p < 40) return 'Caution'; return 'Healthy'; }

    function updateTimerOnce(el) {
       const target = parseInt(el.getAttribute('data-target'));
       if (!target) return;
       const diff = target - Date.now();
       if (diff <= 0) { el.textContent = 'Ready'; return; }
       el.textContent = new Date(diff).toISOString().substr(11, 8);
    }

    setInterval(() => {
      const el = document.getElementById('reset-timer-display');
      if (el && el.offsetParent !== null) updateTimerOnce(el);
    }, 1000);

  </script>
</body>
</html>`;
}
