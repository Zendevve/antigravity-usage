/**
 * Shared Design System - "Shadcn" Inspired
 * Maps VS Code theme variables to Shadcn-like tokens for a consistent, premium feel.
 */

export const SHADCN_CSS = `
:root {
  --background: var(--vscode-editor-background);
  --foreground: var(--vscode-editor-foreground);

  --card: var(--vscode-sideBar-background); /* Use sidebar bg for cards to contrast with editor if needed, or editor bg with border */
  --card-foreground: var(--vscode-editor-foreground);

  --popover: var(--vscode-editorWidget-background);
  --popover-foreground: var(--vscode-editorWidget-foreground);

  --primary: var(--vscode-button-background);
  --primary-foreground: var(--vscode-button-foreground);

  --secondary: var(--vscode-editor-inactiveSelectionBackground);
  --secondary-foreground: var(--vscode-editor-foreground);

  --muted: var(--vscode-editor-inactiveSelectionBackground);
  --muted-foreground: var(--vscode-descriptionForeground);

  --accent: var(--vscode-list-hoverBackground);
  --accent-foreground: var(--vscode-list-hoverForeground);

  --destructive: var(--vscode-editorError-foreground);
  --destructive-foreground: var(--vscode-editor-background);

  --border: var(--vscode-panel-border);
  --input: var(--vscode-input-background);
  --ring: var(--vscode-focusBorder);

  --radius: 0.5rem;
  --font-sans: var(--vscode-font-family);
}

body {
  font-family: var(--font-sans);
  font-size: var(--vscode-font-size);
  color: var(--foreground);
  background: var(--background);
  line-height: 1.5;
  margin: 0;
  -webkit-font-smoothing: antialiased;
}

/* Utilities */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.justify-between { justify-content: space-between; }
.justify-center { justify-content: center; }
.gap-1 { gap: 0.25rem; }
.gap-2 { gap: 0.5rem; }
.gap-4 { gap: 1rem; }

.p-2 { padding: 0.5rem; }
.p-4 { padding: 1rem; }
.px-4 { padding-left: 1rem; padding-right: 1rem; }
.py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }

.text-sm { font-size: 0.875rem; line-height: 1.25rem; }
.text-xs { font-size: 0.75rem; line-height: 1rem; }
.text-lg { font-size: 1.125rem; line-height: 1.75rem; }
.text-xl { font-size: 1.25rem; line-height: 1.75rem; }
.text-2xl { font-size: 1.5rem; line-height: 2rem; }
.text-4xl { font-size: 2.25rem; line-height: 2.5rem; }

.font-bold { font-weight: 700; }
.font-semibold { font-weight: 600; }
.font-medium { font-weight: 500; }

.text-muted-foreground { color: var(--muted-foreground); }
.text-primary { color: var(--primary); }
.text-destructive { color: var(--destructive); }

/* Components */
.card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background-color: var(--card);
  color: var(--card-foreground);
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
}

.card-header {
  padding: 1.5rem 1.5rem 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.card-title {
  font-size: 1.5rem;
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.025em;
}

.card-description {
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.card-content {
  padding: 1.5rem;
}

.badge {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid transparent;
  padding: 0.125rem 0.625rem;
  font-size: 0.75rem;
  font-weight: 600;
  transition: all 0.2s;
}

.badge-outline { border-color: var(--border); }
.badge-secondary { background: var(--secondary); color: var(--secondary-foreground); }
.badge-destructive { background: var(--destructive); color: var(--destructive-foreground); }
.badge-good { background: rgba(34, 197, 94, 0.1); color: var(--vscode-testing-iconPassed); border: 1px solid rgba(34, 197, 94, 0.2); }
.badge-warning { background: rgba(249, 115, 22, 0.1); color: var(--vscode-editorWarning-foreground); border: 1px solid rgba(249, 115, 22, 0.2); }
.badge-danger { background: rgba(239, 68, 68, 0.1); color: var(--vscode-editorError-foreground); border: 1px solid rgba(239, 68, 68, 0.2); }

.separator {
  height: 1px;
  background-color: var(--border);
  margin: 1rem 0;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 500;
  height: 2.25rem;
  padding: 0 1rem;
  cursor: pointer;
  transition: opacity 0.2s;
  border: none;
  outline: none;
}
.button:hover { opacity: 0.9; }
.button-primary { background: var(--primary); color: var(--primary-foreground); }
.button-ghost { background: transparent; color: var(--foreground); }
.button-ghost:hover { background: var(--accent); color: var(--accent-foreground); }
.button-outline { border: 1px solid var(--border); background: transparent; }
.button-outline:hover { background: var(--accent); }

/* Progress Bar */
.progress {
  height: 0.5rem;
  width: 100%;
  overflow: hidden;
  border-radius: 9999px;
  background: var(--secondary);
}
.progress-value {
  height: 100%;
  width: 0%;
  background: var(--primary);
  transition: width 0.5s ease;
}
.progress-value.good { background: var(--vscode-testing-iconPassed); }
.progress-value.warning { background: var(--vscode-editorWarning-foreground); }
.progress-value.danger { background: var(--vscode-editorError-foreground); }

/* Animation */
@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }

/* Dashboard Grid Layouts */
.grid-cols-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-4 { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); }
.grid-gap-4 { gap: 1rem; }

/* Custom Scrollbar */
::-webkit-scrollbar { width: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`;
