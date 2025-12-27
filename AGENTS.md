# Antigravity Usage - Agent Guidelines (MCAF)

> **Managed Code Coding AI Framework**
> This document defines how AI agents must interact with this repository.

## 1. Core Philosophy: Laws of UX

All design decisions must be justified by specific psychological principles:
- **Aesthetic-Usability Effect**: Beauty = Usability.
- **Hick's Law**: Minimize choices.
- **Miller's Law**: Chunk information (max 5 items).
- **Doherty Threshold**: <400ms feedback loop.

## 2. Personal Repository Guidelines (PRG)

### Documentation
- `docs/Features/`: Functional specs.
- `docs/ADR/`: Architectural decisions.
- `docs/Development/`: Setup and guides.

### Development Cycle
1. **Plan**: Update `task.md` and `implementation_plan.md`.
2. **Document**: Write/update feature docs in `docs/`.
3. **Test**: Create verification steps.
4. **Implement**: Write code.
5. **Verify**: Run tests and lint.

## 3. Operational Rules

### Testing Discipline
- Run `npm run compile` to check Typescript errors.
- Run `npm run lint` to enforce style.
- Run `npm run test` for logic verification.

### Coding Standards
- **Strict TypeScript**: No `any`. Explicit interfaces.
- **Functional Core, Imperative Shell**: Logic in `core/` (pure), side effects in `extension.ts` or `ui/`.
- **Single Source of Truth**: State lives in `QuotaStore`.

### Communication
- **Task Boundaries**: precise update of status.
- **Artifacts**: Keep `task.md` live.

## 4. Commands & Workflows

- **/design-pillars**: (Deprecated) See Laws of UX.
- **Build**: `npm run compile`
- **Package**: `npx vsce package`
