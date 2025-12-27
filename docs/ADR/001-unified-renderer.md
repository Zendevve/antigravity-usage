# ADR 001: Unified UI Rendering Architecture

## Status
Accepted

## Context
In v0.9, the extension used three separate rendering paths:
1. `statusBar.ts` (string manipulation)
2. `custatsSidebar.ts` (HTML string generation)
3. `custatsDashboard.ts` (HTML string generation)

This led to:
- Inconsistent visual styles
- Code duplication
- "Drift" where features were added to dashboard but missed in sidebar
- High maintenance burden

## Decision
We will implement a **Single Source of Truth** for UI rendering: `src/ui/UIRenderer.ts`.

This renderer will:
- Accept a single `QuotaState` object.
- Accept a `ViewMode` argument ('compact' | 'full').
- Generate HTML for *both* Sidebar and Dashboard using shared components.
- Use a unified `DesignTokens.ts` for CSS variables.

## Consequences

### Positive
- **Consistency**: Sidebar is guaranteed to look like a mini-Dashboard.
- **Maintainability**: Change a card style once, update everywhere.
- **Performance**: Shared optimization and caching strategies.

### Negative
- **Abstraction Cost**: Renderer code is slightly more complex than inline HTML.
- **Flexibility**: "Special case" tweaks for one view need explicit handling in the shared renderer.

## Compliance
- **Jakob's Law**: Users expect consistent experience across views.
- **Law of Repetition**: Consistent visual elements strengthen recognition.
