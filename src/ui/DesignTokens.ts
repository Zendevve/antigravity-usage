/**
 * Design Tokens - Unified Design System
 *
 * Laws of UX Applied:
 * - Aesthetic-Usability Effect: Premium, beautiful design users perceive as more usable
 * - Jakob's Law: Maps to native VS Code patterns for familiarity
 * - Von Restorff Effect: Distinct status colors for critical states
 * - Law of Proximity: Consistent spacing scale
 * - Doherty Threshold: Smooth, fast animations (150ms)
 */

// ============================================================================
// CSS Design Tokens
// ============================================================================

export const DESIGN_TOKENS_CSS = `
/* ==========================================================================
   DESIGN TOKENS - Antigravity Usage V2
   Built on Laws of UX psychology principles
   ========================================================================== */

:root {
  /* -----------------------------------------------------------------------
     Core Colors (Jakob's Law: VS Code native patterns)
     ----------------------------------------------------------------------- */
  --ag-bg: var(--vscode-editor-background);
  --ag-fg: var(--vscode-editor-foreground);
  --ag-fg-muted: var(--vscode-descriptionForeground);
  --ag-border: var(--vscode-panel-border);
  --ag-accent: var(--vscode-focusBorder);
  --ag-link: var(--vscode-textLink-foreground);

  /* Card backgrounds */
  --ag-card-bg: var(--vscode-sideBar-background);
  --ag-card-hover: var(--vscode-list-hoverBackground);

  /* -----------------------------------------------------------------------
     Status Colors (Von Restorff Effect: memorable & distinct)
     ----------------------------------------------------------------------- */
  --ag-status-good: var(--vscode-testing-iconPassed, #4ec9b0);
  --ag-status-warn: var(--vscode-editorWarning-foreground, #cca700);
  --ag-status-danger: var(--vscode-editorError-foreground, #f14c4c);
  --ag-status-muted: var(--vscode-disabledForeground, #6e6e6e);

  /* -----------------------------------------------------------------------
     Spacing Scale (Law of Proximity: consistent grouping)
     4px base unit for visual harmony
     ----------------------------------------------------------------------- */
  --ag-space-1: 0.25rem;   /*  4px */
  --ag-space-2: 0.5rem;    /*  8px */
  --ag-space-3: 0.75rem;   /* 12px */
  --ag-space-4: 1rem;      /* 16px */
  --ag-space-5: 1.25rem;   /* 20px */
  --ag-space-6: 1.5rem;    /* 24px */

  /* -----------------------------------------------------------------------
     Typography
     ----------------------------------------------------------------------- */
  --ag-font-family: var(--vscode-font-family);
  --ag-font-size-xs: 11px;
  --ag-font-size-sm: 12px;
  --ag-font-size-base: 13px;
  --ag-font-size-lg: 14px;
  --ag-font-size-xl: 18px;
  --ag-font-size-2xl: 24px;

  /* -----------------------------------------------------------------------
     Animation (Doherty Threshold: <400ms feedback)
     ----------------------------------------------------------------------- */
  --ag-transition-fast: 100ms ease;
  --ag-transition-base: 150ms ease;
  --ag-transition-slow: 300ms ease;

  /* -----------------------------------------------------------------------
     Borders & Radius
     ----------------------------------------------------------------------- */
  --ag-radius-sm: 4px;
  --ag-radius-md: 6px;
  --ag-radius-lg: 8px;
  --ag-radius-full: 9999px;
}

/* ==========================================================================
   BASE RESET
   ========================================================================== */

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: var(--ag-space-3);
  font-family: var(--ag-font-family);
  font-size: var(--ag-font-size-base);
  color: var(--ag-fg);
  background: transparent;
  line-height: 1.5;
}

/* ==========================================================================
   CARD COMPONENT (Law of Common Region: clear grouping)
   ========================================================================== */

.ag-card {
  background: var(--ag-card-bg);
  border: 1px solid var(--ag-border);
  border-radius: var(--ag-radius-md);
  padding: var(--ag-space-3);
  transition: border-color var(--ag-transition-base);
}

.ag-card:hover {
  border-color: var(--ag-accent);
}

.ag-card--primary {
  border-color: var(--ag-accent);
  border-width: 2px;
}

.ag-card--compact {
  padding: var(--ag-space-2);
}

/* ==========================================================================
   PROGRESS BAR (Goal-Gradient Effect: rewarding progress)
   ========================================================================== */

.ag-progress {
  height: 8px;
  background: var(--vscode-progressBar-background, rgba(255,255,255,0.1));
  border-radius: var(--ag-radius-full);
  overflow: hidden;
}

.ag-progress__fill {
  height: 100%;
  border-radius: var(--ag-radius-full);
  transition: width var(--ag-transition-base), background-color var(--ag-transition-base);
}

.ag-progress__fill--good {
  background: var(--ag-status-good);
}

.ag-progress__fill--warn {
  background: var(--ag-status-warn);
}

.ag-progress__fill--danger {
  background: var(--ag-status-danger);
}

.ag-progress--large {
  height: 12px;
}

/* ==========================================================================
   BUTTONS (Fitts's Law: large, easy targets)
   ========================================================================== */

.ag-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--ag-space-1);
  min-height: 32px;
  padding: var(--ag-space-2) var(--ag-space-3);
  font-size: var(--ag-font-size-sm);
  font-family: var(--ag-font-family);
  color: var(--ag-fg);
  background: var(--vscode-button-background);
  border: none;
  border-radius: var(--ag-radius-sm);
  cursor: pointer;
  transition: background-color var(--ag-transition-fast);
}

.ag-btn:hover {
  background: var(--vscode-button-hoverBackground);
}

.ag-btn:focus {
  outline: 2px solid var(--ag-accent);
  outline-offset: 2px;
}

.ag-btn--secondary {
  background: var(--vscode-button-secondaryBackground);
}

.ag-btn--secondary:hover {
  background: var(--vscode-button-secondaryHoverBackground);
}

.ag-btn--ghost {
  background: transparent;
  color: var(--ag-link);
}

.ag-btn--ghost:hover {
  background: var(--ag-card-hover);
}

/* ==========================================================================
   BADGES
   ========================================================================== */

.ag-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  font-size: var(--ag-font-size-xs);
  font-weight: 500;
  border-radius: var(--ag-radius-sm);
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
}

.ag-badge--good {
  background: rgba(78, 201, 176, 0.2);
  color: var(--ag-status-good);
}

.ag-badge--warn {
  background: rgba(204, 167, 0, 0.2);
  color: var(--ag-status-warn);
}

.ag-badge--danger {
  background: rgba(241, 76, 76, 0.2);
  color: var(--ag-status-danger);
}

/* ==========================================================================
   TYPOGRAPHY UTILITIES
   ========================================================================== */

.ag-text-muted {
  color: var(--ag-fg-muted);
}

.ag-text-good {
  color: var(--ag-status-good);
}

.ag-text-warn {
  color: var(--ag-status-warn);
}

.ag-text-danger {
  color: var(--ag-status-danger);
}

.ag-text-xs {
  font-size: var(--ag-font-size-xs);
}

.ag-text-sm {
  font-size: var(--ag-font-size-sm);
}

.ag-text-lg {
  font-size: var(--ag-font-size-lg);
}

.ag-text-xl {
  font-size: var(--ag-font-size-xl);
}

.ag-text-2xl {
  font-size: var(--ag-font-size-2xl);
}

.ag-font-bold {
  font-weight: 600;
}

.ag-font-mono {
  font-family: var(--vscode-editor-font-family);
}

/* ==========================================================================
   LAYOUT UTILITIES
   ========================================================================== */

.ag-flex {
  display: flex;
}

.ag-flex-col {
  flex-direction: column;
}

.ag-items-center {
  align-items: center;
}

.ag-justify-between {
  justify-content: space-between;
}

.ag-gap-1 { gap: var(--ag-space-1); }
.ag-gap-2 { gap: var(--ag-space-2); }
.ag-gap-3 { gap: var(--ag-space-3); }
.ag-gap-4 { gap: var(--ag-space-4); }

.ag-mt-1 { margin-top: var(--ag-space-1); }
.ag-mt-2 { margin-top: var(--ag-space-2); }
.ag-mt-3 { margin-top: var(--ag-space-3); }
.ag-mt-4 { margin-top: var(--ag-space-4); }

.ag-mb-1 { margin-bottom: var(--ag-space-1); }
.ag-mb-2 { margin-bottom: var(--ag-space-2); }
.ag-mb-3 { margin-bottom: var(--ag-space-3); }
.ag-mb-4 { margin-bottom: var(--ag-space-4); }

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

@keyframes ag-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.ag-animate-pulse {
  animation: ag-pulse 2s ease-in-out infinite;
}

@keyframes ag-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.ag-animate-spin {
  animation: ag-spin 1s linear infinite;
}

/* ==========================================================================
   SECTION HEADERS (Serial Position Effect: clear hierarchy)
   ========================================================================== */

.ag-section {
  margin-bottom: var(--ag-space-4);
}

.ag-section__header {
  display: flex;
  align-items: center;
  gap: var(--ag-space-2);
  margin-bottom: var(--ag-space-2);
  font-size: var(--ag-font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--ag-fg-muted);
}

.ag-section__header::before {
  content: '';
  display: block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ag-accent);
}

/* ==========================================================================
   MODEL LIST (Miller's Law: chunked items)
   ========================================================================== */

.ag-model-list {
  display: flex;
  flex-direction: column;
  gap: var(--ag-space-2);
}

.ag-model-item {
  display: flex;
  align-items: center;
  gap: var(--ag-space-3);
  padding: var(--ag-space-2);
  border-radius: var(--ag-radius-sm);
  transition: background-color var(--ag-transition-fast);
}

.ag-model-item:hover {
  background: var(--ag-card-hover);
}

.ag-model-item__info {
  flex: 1;
  min-width: 0;
}

.ag-model-item__name {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ag-model-item__meta {
  font-size: var(--ag-font-size-xs);
  color: var(--ag-fg-muted);
}

.ag-model-item__percent {
  font-size: var(--ag-font-size-lg);
  font-weight: 600;
  font-family: var(--vscode-editor-font-family);
}

/* ==========================================================================
   EMPTY STATE
   ========================================================================== */

.ag-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ag-space-6);
  text-align: center;
  color: var(--ag-fg-muted);
}

.ag-empty__icon {
  font-size: 32px;
  margin-bottom: var(--ag-space-3);
  opacity: 0.5;
}

/* ==========================================================================
   LOADING STATE
   ========================================================================== */

.ag-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--ag-space-6);
  color: var(--ag-fg-muted);
}

.ag-loading__spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--ag-border);
  border-top-color: var(--ag-accent);
  border-radius: 50%;
  animation: ag-spin 1s linear infinite;
  margin-bottom: var(--ag-space-3);
}
`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get status class based on percentage
 * Applies Von Restorff Effect: distinct colors for critical states
 */
export function getStatusClass(percent: number): string {
  if (percent >= 50) return 'good';
  if (percent >= 25) return 'warn';
  return 'danger';
}

/**
 * Get status color CSS variable
 */
export function getStatusColor(percent: number): string {
  if (percent >= 50) return 'var(--ag-status-good)';
  if (percent >= 25) return 'var(--ag-status-warn)';
  return 'var(--ag-status-danger)';
}
