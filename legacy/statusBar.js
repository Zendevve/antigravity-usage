"use strict";
/**
 * Status Bar Manager - Invisible Interface Edition
 * Minimal, content-first display. The data speaks for itself.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusBarManager = void 0;
const vscode = require("vscode");
class StatusBarManager {
    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBarItem.command = 'workbench.view.extension.antigravity-usage-container';
        this.statusBarItem.text = 'AG';
        this.statusBarItem.tooltip = 'Antigravity Usage - Loading...';
        this.statusBarItem.show();
    }
    showDetecting() {
        this.statusBarItem.text = 'AG...';
        this.statusBarItem.tooltip = 'Detecting Antigravity...';
        this.statusBarItem.backgroundColor = undefined;
    }
    showInitializing() {
        this.statusBarItem.text = 'AG...';
        this.statusBarItem.tooltip = 'Initializing...';
        this.statusBarItem.backgroundColor = undefined;
    }
    showFetching() {
        this.statusBarItem.text = 'AG...';
        this.statusBarItem.tooltip = 'Syncing...';
        this.statusBarItem.backgroundColor = undefined;
    }
    showRetrying(attempt, maxAttempts) {
        this.statusBarItem.text = `AG $(sync~spin) ${attempt}/${maxAttempts}`;
        this.statusBarItem.tooltip = `Retrying... (${attempt}/${maxAttempts})`;
        this.statusBarItem.backgroundColor = undefined;
    }
    showRefreshing() {
        this.statusBarItem.text = 'AG $(sync~spin)';
        this.statusBarItem.tooltip = 'Refreshing...';
        this.statusBarItem.backgroundColor = undefined;
    }
    showError(message) {
        this.statusBarItem.text = 'AG';
        this.statusBarItem.tooltip = `Error: ${message}\n\nClick to retry`;
        this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
    }
    /**
     * Main update with insights data - minimal display
     */
    updateWithInsights(snapshot) {
        this.lastSnapshot = snapshot;
        const models = snapshot.modelsWithInsights;
        if (!models || models.length === 0) {
            this.statusBarItem.text = 'AG —';
            this.statusBarItem.tooltip = 'No data available';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }
        // Find primary model (sorted by priority: Pinned > Active > Lowest)
        const primary = models[0];
        const shortName = this.getShortName(primary.label);
        // Clean, minimal display based on configured style
        // Dynamic Status Bar Text
        const config = vscode.workspace.getConfiguration('antigravity');
        const style = config.get('displayStyle', 'percentage');
        // Determine icon based on status/activity
        let icon = '$(pulse)'; // Default active pulse
        if (primary.isExhausted)
            icon = '$(error)';
        else if (primary.remainingPercent < 15)
            icon = '$(alert)';
        else if (primary.remainingPercent < 25)
            icon = '$(warning)';
        // User requested format: "$(pulse) 28% Usage"
        // We'll respect the style preference but default to the requested format if 'percentage' is selected
        if (style === 'percentage') {
            this.statusBarItem.text = `${icon} ${primary.remainingPercent}% Usage`;
        }
        else {
            this.statusBarItem.text = this.formatDisplay(shortName, primary.remainingPercent, style);
        }
        // Background only for critical situations
        if (primary.isExhausted || primary.remainingPercent < 15) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        else if (primary.remainingPercent < 25) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this.statusBarItem.backgroundColor = undefined;
        }
        this.statusBarItem.tooltip = this.buildMarkdownTooltip(snapshot);
    }
    /**
     * Fallback for basic quota data (without insights)
     */
    update(quotas) {
        if (!quotas || quotas.length === 0) {
            this.statusBarItem.text = 'AG —';
            this.statusBarItem.tooltip = 'No data available';
            this.statusBarItem.backgroundColor = undefined;
            return;
        }
        // Find most used model
        const sorted = [...quotas].sort((a, b) => a.remainingPercent - b.remainingPercent);
        const primary = sorted[0];
        const shortName = this.getShortName(primary.label);
        this.statusBarItem.text = `${shortName} ${primary.remainingPercent}%`;
        if (primary.isExhausted || primary.remainingPercent < 15) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        else if (primary.remainingPercent < 25) {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        }
        else {
            this.statusBarItem.backgroundColor = undefined;
        }
        // Simple tooltip
        const lines = quotas.map(q => {
            const reset = q.timeUntilReset ? ` · ${q.timeUntilReset}` : '';
            return `${q.label}: ${q.remainingPercent}%${reset}`;
        });
        this.statusBarItem.tooltip = lines.join('\n');
    }
    getShortName(label) {
        if (label.includes('Claude')) {
            if (label.includes('Sonnet'))
                return 'Sonnet';
            if (label.includes('Opus'))
                return 'Opus';
            if (label.includes('Haiku'))
                return 'Haiku';
            return 'Claude';
        }
        if (label.includes('Gemini')) {
            if (label.includes('Pro'))
                return 'Pro';
            if (label.includes('Flash'))
                return 'Flash';
            return 'Gemini';
        }
        if (label.includes('GPT') || label.includes('O3') || label.includes('O1')) {
            return 'GPT';
        }
        // First word, max 6 chars
        return label.split(' ')[0].substring(0, 6);
    }
    /**
     * Format display based on style preference
     */
    formatDisplay(name, percent, style) {
        switch (style) {
            case 'progressBar':
                return `${name} ${this.buildProgressBar(percent)}`;
            case 'dots':
                return `${name} ${this.buildDots(percent)}`;
            case 'percentage':
            default:
                return `${name} ${percent}%`;
        }
    }
    buildProgressBar(percent) {
        const filled = Math.round(percent / 20);
        const empty = 5 - filled;
        return '█'.repeat(filled) + '░'.repeat(empty);
    }
    buildDots(percent) {
        const filled = Math.round(percent / 20);
        const empty = 5 - filled;
        return '●'.repeat(filled) + '○'.repeat(empty);
    }
    /**
     * Build rich markdown tooltip with Live Session and Weekly Stats
     */
    buildMarkdownTooltip(snapshot) {
        const md = new vscode.MarkdownString();
        md.isTrusted = true;
        md.supportHtml = true;
        // Header
        md.appendMarkdown(`**CUStats** ${snapshot.healthLabel ? `(${snapshot.healthLabel})` : ''}\n\n`);
        // Live Session Section
        const activeModel = snapshot.modelsWithInsights.find(m => m.insights.isActive);
        if (activeModel) {
            md.appendMarkdown('### 🔴 Live Session\n');
            md.appendMarkdown(`**${activeModel.label}**\n`);
            const used = (100 - activeModel.remainingPercent).toFixed(1);
            md.appendMarkdown(`Usage: **${used}%** · Remaining: **${activeModel.remainingPercent}%**\n\n`);
            if (activeModel.insights.burnRate > 0) {
                md.appendMarkdown(`Burn Rate: ${activeModel.insights.burnRate.toFixed(2)}%/hr\n`);
                if (activeModel.insights.predictedExhaustionLabel) {
                    md.appendMarkdown(`Est. Exhaustion: ${activeModel.insights.predictedExhaustionLabel}\n`);
                }
            }
            md.appendMarkdown('---\n');
        }
        // Weekly Limits (Models)
        md.appendMarkdown('### 📅 Weekly Limits\n\n');
        md.appendMarkdown('| Model | Status | Remaining |\n');
        md.appendMarkdown('| :--- | :--- | :---: |\n');
        for (const model of snapshot.modelsWithInsights) {
            const statusIcon = model.isExhausted ? '🔴' : (model.remainingPercent < 25 ? '🟡' : '🟢');
            const statusText = model.isExhausted ? 'Exhausted' : (model.remainingPercent < 25 ? 'Caution' : 'Good');
            md.appendMarkdown(`| ${model.label} | ${statusIcon} ${statusText} | **${model.remainingPercent}%** |\n`);
        }
        // Credits (Optional)
        if (snapshot.promptCredits) {
            md.appendMarkdown('\n---\n');
            const p = snapshot.promptCredits;
            md.appendMarkdown(`**Credits**: ${p.available.toLocaleString()} / ${p.monthly.toLocaleString()}\n`);
        }
        md.appendMarkdown('\n$(layout-sidebar-right) **Click to open sidebar**\n\n');
        md.appendMarkdown('[$(dashboard) Open Full Dashboard](command:antigravity-quota.openDashboard)');
        return md;
    }
    buildMinimalTooltip(snapshot) {
        const lines = [];
        // Just the model list with percentages
        for (const model of snapshot.modelsWithInsights) {
            const active = model.insights.isActive ? '› ' : '  ';
            const reset = model.timeUntilReset ? ` · ${model.timeUntilReset}` : '';
            lines.push(`${active}${model.label}: ${model.remainingPercent}%${reset}`);
        }
        // Credits if available
        if (snapshot.promptCredits) {
            lines.push('');
            lines.push(`Credits: ${snapshot.promptCredits.available.toLocaleString()} / ${snapshot.promptCredits.monthly.toLocaleString()}`);
        }
        lines.push('');
        lines.push('Click for details');
        return lines.join('\n');
    }
    getSnapshot() {
        return this.lastSnapshot;
    }
    dispose() {
        this.statusBarItem.dispose();
    }
}
exports.StatusBarManager = StatusBarManager;
//# sourceMappingURL=statusBar.js.map