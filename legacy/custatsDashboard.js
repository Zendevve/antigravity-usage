"use strict";
/**
 * CUStats-Style Dashboard HTML Builder
 * Generates the premium dashboard UI matching CUStats aesthetics.
 * Uses Client-Side Rendering (CSR) for smooth updates without flickering.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildCUStatsDashboard = buildCUStatsDashboard;
const designSystem_1 = require("./designSystem");
function buildCUStatsDashboard(snapshot, cacheInfo, showInsights = false) {
    const initialData = JSON.stringify({ snapshot, cacheInfo, showInsights });
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Usage</title>
  <style>
    ${designSystem_1.SHADCN_CSS}
    /* Dashboard Specific Overrides */
    body { padding: 1.5rem; max-width: 800px; margin: 0 auto; }
    .chart-container { height: 120px; width: 100%; margin-top: 1rem; }
    .peak-bar { transition: height 0.3s ease; border-radius: 2px 2px 0 0; opacity: 0.8; }
    .peak-bar:hover { opacity: 1; }
    .peak-bar.active { opacity: 1; }
  </style>
</head>
<body class="preload">
  <div class="flex flex-col gap-4">

    <!-- Top Row: Active Session & Status -->
    <div class="card p-4">
      <div class="flex justify-between items-center mb-4">
        <div class="flex items-center gap-2">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-green-500 animate-pulse" id="live-dot"></div>
            <span class="text-sm font-semibold tracking-tight">Active Session</span>
          </div>
          <span id="session-model-name" class="text-sm text-muted-foreground ml-2">--</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span id="session-time-window">--:-- → Now</span>
          <span class="text-muted-foreground/50">|</span>
          <span id="session-countdown" class="font-mono font-medium text-primary">--:--</span>
        </div>
      </div>

      <div class="flex items-end justify-between">
        <div>
          <div class="text-sm font-medium text-muted-foreground">Usage</div>
          <div class="flex items-baseline gap-1">
            <span id="live-used" class="text-4xl font-bold tracking-tighter">--%</span>
            <span class="text-sm text-muted-foreground">/</span>
            <span id="live-remaining" class="text-lg text-muted-foreground font-medium">--%</span>
          </div>
        </div>

        <!-- Quick Stats Mini-Grid -->
        <div class="grid grid-cols-4 gap-4 text-right">
          <div>
            <div class="text-xs text-muted-foreground uppercase tracking-wider">Prompt</div>
            <div id="stat-prompt" class="text-lg font-bold">--</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground uppercase tracking-wider">Flow</div>
            <div id="stat-flow" class="text-lg font-bold">--</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground uppercase tracking-wider">Msgs</div>
            <div id="stat-msgs" class="text-lg font-bold">--</div>
          </div>
           <div>
            <div class="text-xs text-muted-foreground uppercase tracking-wider">Tools</div>
            <div id="stat-tools" class="text-lg font-bold">--</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Middle Row: Charts & Consumption -->
    <div class="grid-cols-2 grid-gap-4">
      <!-- Chart Card -->
      <div class="card p-4">
        <div class="flex justify-between items-center">
          <h3 class="font-semibold leading-none tracking-tight">Usage Trend</h3>
          <span class="text-xs text-muted-foreground">Live</span>
        </div>
        <div id="chart-container" class="chart-container">
          <!-- SVG injected -->
        </div>
      </div>

      <!-- Peak Card -->
      <div class="card p-4">
        <div class="flex justify-between items-center mb-2">
          <h3 class="font-semibold leading-none tracking-tight">Consumption Peak</h3>
          <span class="text-xs text-muted-foreground">15m windows</span>
        </div>
        <div class="flex items-baseline gap-2 mb-4">
          <span id="peak-val" class="text-2xl font-bold">--%</span>
          <span class="text-xs text-muted-foreground">peak</span>
          <span class="text-xs text-muted-foreground ml-2">Avg: <span id="avg-val" class="font-medium text-foreground">--%</span>/min</span>
        </div>
        <div id="peak-bars" class="flex items-end gap-1 h-[60px]" style="height: 60px;">
          <!-- Bars injected -->
        </div>
      </div>
    </div>

    <!-- Bot Components List -->
    <div class="card">
      <div class="card-header pb-2">
        <h3 class="font-semibold leading-none tracking-tight">All Models</h3>
        <p class="text-sm text-muted-foreground">Real-time quota status for all connected models.</p>
      </div>
      <div class="card-content pt-0">
        <div id="other-models-list" class="flex flex-col gap-2 mt-4">
          <!-- Models injected -->
        </div>
      </div>
    </div>

    <!-- Insights Collapsible -->
    <div class="card">
      <div class="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/50 transition-colors" onclick="toggleInsights()">
        <div class="flex items-center gap-2">
          <span class="text-lg">💡</span>
          <span class="font-semibold">Insights & Health</span>
        </div>
        <div id="health-link" class="badge">--</div>
      </div>

      <div id="insights-panel" style="display: none;">
        <div class="separator mt-0"></div>
        <div class="p-4 grid-cols-4 grid-gap-4">
          <div>
            <div class="text-xs text-muted-foreground">Burn Rate</div>
            <div id="insight-burn" class="font-medium">--</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Est. Exhaustion</div>
            <div id="insight-eta" class="font-medium">--</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Session Impact</div>
            <div id="insight-session" class="font-medium">--</div>
          </div>
          <div>
            <div class="text-xs text-muted-foreground">Models</div>
            <div id="insight-count" class="font-medium">--</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center mt-2 text-xs text-muted-foreground">
      <div class="flex gap-2">
        <span id="last-updated">Synced just now</span>
        <span>•</span>
        <span>v0.9.0</span>
      </div>
      <div class="flex gap-2">
        <button class="button button-outline h-8" onclick="cleanCache()">Clear Cache</button>
        <button class="button button-primary h-8" onclick="refresh()">Refresh Data</button>
      </div>
    </div>

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

    function toggleInsights() { vscode.postMessage({ command: 'toggleInsights' }); }
    function cleanCache() { vscode.postMessage({ command: 'cleanCache' }); }
    function refresh() { vscode.postMessage({ command: 'refresh' }); }

    function render(state) {
      if (!state || !state.snapshot) return;
      const snap = state.snapshot;
      const primary = snap.modelsWithInsights.find(m => m.insights.isActive) || snap.modelsWithInsights[0];

      // Session Header
      setText('session-model-name', primary ? primary.label : 'Idle');
      setText('live-used', primary ? (100 - primary.remainingPercent).toFixed(1) + '%' : '--');
      setText('live-remaining', primary ? primary.remainingPercent.toFixed(1) + '%' : '--');

      // Live Dot Color
      const dot = document.getElementById('live-dot');
      if (dot) dot.style.backgroundColor = primary ? getStatusColor(primary.remainingPercent) : 'var(--muted)';

      setText('session-time-window', \`\${formatTime(new Date(snap.sessionStartTime))} → Now\`);

      // Countdown
      const timerEl = document.getElementById('session-countdown');
      if (primary && primary.resetTime) {
         timerEl.setAttribute('data-target', new Date(primary.resetTime).getTime());
         updateTimerOnce(timerEl);
      } else {
         timerEl.textContent = '—';
      }

      // Stats
      const prompt = snap.promptCredits;
      const flow = snap.flowCredits;
      const promptUsed = prompt ? (prompt.monthly - prompt.available) : 0;
      const flowUsed = flow ? (flow.monthly - flow.available) : 0;

      setText('stat-prompt', formatNumber(promptUsed));
      setText('stat-flow', formatNumber(flowUsed));
      setText('stat-msgs', Math.max(1, Math.floor(snap.totalSessionUsage * 3)).toString());
      setText('stat-tools', flow ? Math.floor(flowUsed/100).toString() : '0');

      // Graphs
      renderChart(snap);
      renderPeaks(snap.usageBuckets);

      // Models List
      const otherModels = snap.modelsWithInsights.filter(m => true); // Show all in the list for completeness? Or exclude primary? Let's show all for "All Models"
      const listEl = document.getElementById('other-models-list');
      listEl.innerHTML = otherModels.map(m => buildModelRow(m)).join('');

      // Insights
      const show = state.showInsights;
      document.getElementById('insights-panel').style.display = show ? 'block' : 'none';
      if (primary) {
        setText('insight-burn', primary.insights.burnRateLabel || 'N/A');
        setText('insight-eta', primary.insights.predictedExhaustionLabel || 'N/A');
        setText('insight-session', (primary.insights.sessionUsage || 0).toFixed(1) + '%');
        setText('insight-count', snap.modelsWithInsights.length.toString());
      }

      // Health Badge
      const healthLink = document.getElementById('health-link');
      const status = getStatus(primary ? primary.remainingPercent : 100);
      healthLink.className = \`badge badge-\${status}\`;
      healthLink.textContent = \`Health: \${capitalize(status)}\`;

      // Footer
      const timeDiff = Math.floor((new Date().getTime() - new Date(snap.timestamp).getTime()) / 1000);
      setText('last-updated', 'Synced ' + (timeDiff < 60 ? 'just now' : Math.floor(timeDiff/60) + 'm ago'));
    }

    /* Rendering Helpers */
    function buildModelRow(model) {
      const used = 100 - model.remainingPercent;
      const status = getStatus(model.remainingPercent);
      return \`
        <div class="flex flex-col gap-1 p-2 rounded hover:bg-accent/50 transition-colors border border-transparent hover:border-border">
          <div class="flex justify-between items-center">
            <span class="font-medium text-sm">\${model.label}</span>
            <span class="text-sm font-semibold">\${used}%</span>
          </div>
          <div class="progress">
            <div class="progress-value \${status}" style="width: \${used}%"></div>
          </div>
          <div class="flex justify-between text-xs text-muted-foreground mt-1">
             <span>\${(model.timeUntilReset || 'Active')}</span>
             <span class="\${status === 'danger' ? 'text-destructive' : ''}">\${getStatusLabel(model.remainingPercent)}</span>
          </div>
        </div>
      \`;
    }

    function renderChart(snap) {
      const container = document.getElementById('chart-container');
      const primary = snap.modelsWithInsights[0];
      if (!primary || primary.insights.historyData.length < 2) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-xs text-muted-foreground italic">Not enough data</div>';
        return;
      }
      const data = primary.insights.historyData.map(v => 100 - v);
      const width = container.clientWidth;
      const height = container.clientHeight;
      const padding = 4;

      const max = Math.max(...data, 10);
      const min = Math.min(...data, 0);
      const range = max - min || 1;

      const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
        const y = height - padding - ((d - min) / range) * (height - 2 * padding);
        return \`\${x},\${y}\`;
      }).join(' ');

      const lineCol = getComputedStyle(document.body).getPropertyValue('--primary').trim();

      container.innerHTML = \`
        <svg width="100%" height="100%" viewBox="0 0 \${width} \${height}" preserveAspectRatio="none" style="overflow: visible;">
           <polyline points="\${points}" fill="none" stroke="\${lineCol}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        </svg>
      \`;
    }

    function renderPeaks(buckets) {
      const container = document.getElementById('peak-bars');
      if (!buckets.length) { container.innerHTML = ''; return; }
      const max = Math.max(...buckets.map(b => b.items.reduce((s,i)=>s+i.usage,0)), 0.1);

      container.innerHTML = buckets.map(b => {
        const val = b.items.reduce((s,i)=>s+i.usage,0);
        const h = Math.max((val / max) * 100, 10);
        const col = val > (max * 0.8) ? 'var(--destructive)' : 'var(--primary)';
        return \`<div class="peak-bar" style="height: \${h}%; width: 100%; background: \${col}; border-radius: 2px;"></div>\`;
      }).join('');

      // Update text
      setText('peak-val', max.toFixed(1) + '%');
    }

    function updateTimerOnce(el) {
       const target = parseInt(el.getAttribute('data-target'));
       if (!target) return;
       const diff = target - Date.now();
       if (diff <= 0) { el.textContent = 'Ready'; return; }
       el.textContent = new Date(diff).toISOString().substr(11, 8); // simple HH:MM:SS
    }

    setInterval(() => { document.querySelectorAll('[data-target]').forEach(updateTimerOnce); }, 1000);

    function setText(id, t) { const e = document.getElementById(id); if(e) e.textContent = t; }
    function formatTime(d) { return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
    function formatNumber(n) { return n >= 1000 ? (n/1000).toFixed(1)+'K' : n; }
    function getStatus(p) { if(p < 15) return 'danger'; if(p < 40) return 'warning'; return 'good'; }
    function getStatusColor(p) { if(p < 15) return 'var(--destructive)'; if(p < 40) return 'var(--vscode-editorWarning-foreground)'; return 'var(--vscode-testing-iconPassed)'; }
    function getStatusLabel(p) { if(p < 15) return 'Critical'; if(p < 40) return 'Caution'; return 'Healthy'; }
    function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  </script>
</body>
</html>`;
}
//# sourceMappingURL=custatsDashboard.js.map