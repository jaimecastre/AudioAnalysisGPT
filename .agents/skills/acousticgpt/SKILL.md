---
name: acousticgpt
description: House style and working rules for the AcousticGPT / AcousticCanvas codebase. Use whenever generating, reviewing, or planning code for this repo — covers the .NET 8 FastEndpoints DSP backend, the React 19 + Mantine vertical-slice frontend, the evidence-based AI agent rules, and the expected feature-response format.
---

# AcousticGPT (AcousticCanvas) — Agent Skill

AcousticGPT is an AI-assisted acoustic investigation and benchmarking platform. The
backend computes deterministic DSP facts; the AI agent only explains those facts.
Treat `AcousticCanvas/PROJECT_CONTEXT.md` and `AcousticCanvas/.windsurfrules` as the
source of truth — this skill condenses them into actionable rules.

## Repository layout

```
AcousticCanvas/
  AcousticCanvas/            # .NET 8 backend (FastEndpoints)
    Features/<Feature>/
      Commands/   Handlers/   Endpoints/
    Program.cs                # register handlers as singletons
  AcousticCanvas.UI/         # React 19 + TS + Vite frontend
    src/
      features/<feature>/     # vertical slices (hooks/ services/ utils/)
      shared/api/             # API client
      store/                  # Redux store + slices
  PROJECT_CONTEXT.md          # product + architecture + roadmap (source of truth)
  .windsurfrules              # code-style rules
```

- API base URL: `http://localhost:5146`.
- Frontend dev: `npm run dev` · build: `npm run build` · lint: `npm run lint` · test: `npm run test` (vitest), all from `AcousticCanvas.UI/`.
- Backend: `dotnet run` / `dotnet build` from `AcousticCanvas/AcousticCanvas/`.

## Architecture: backend owns all logic

- ALL logic, math, DSP, and data transformation live in the **backend**. No exceptions.
- The frontend only renders what the backend returns — it never computes, derives, or transforms data, and contains **no DSP/audio math**.
- Frontend responsibilities: display state, handle user input, call backend endpoints, render results.

## Backend rules (.NET 8 / FastEndpoints)

Every feature is a vertical slice under `Features/<Feature>/`:

- `Commands/` — immutable `record` types only; group the command/query input and its result record together.
- `Handlers/` — one `CommandHandler<TCommand, TResult>` per command; all business logic lives here.
- `Endpoints/` — thin `Endpoint<TRequest, TResponse>` HTTP adapters: validate input, resolve file paths, delegate via `query.ExecuteAsync()`. No business logic.
- Register handlers as **singletons** in `Program.cs`.

Functional principles:
- Use `record` types everywhere for commands/queries/results — never mutable classes.
- Handlers must be **pure**: same input → same output; no writes to shared mutable state or static fields. File reads (audio) are acceptable (idempotent).
- Use `Task.FromResult(value)` for synchronous handlers; only mark `async` for genuine async I/O.
- Keep loops simple and explicit; no LINQ chain longer than two operations; prefer named variables over chained lambdas.

> Note: some older features also contain `Domain/`, `Services/`, and `Importers/` folders. For **new** features follow the canonical `Commands/` + `Handlers/` + `Endpoints/` structure; do not introduce new `Models/`/`Services/` folders.

## Frontend rules (React 19 + TS 6 + Mantine 9)

Component style:
- Declare every component as `export const ComponentName = (): JSX.Element => {` — always const arrow functions, never `function` declarations.
- Always `import type { JSX } from 'react'` (and other React types explicitly, e.g. `import type { JSX, ReactNode } from 'react'`). Never import the default React object.
- Use long, descriptive names so intent is obvious without comments. Avoid one-liners, nested ternaries, and long chains — prefer explicit steps. Keep functions short and single-purpose.

Feature folder structure — every feature lives in `src/features/<featureName>/`:

```
src/features/<featureName>/
  hooks/        # React hooks only (no JSX, no API calls)
  services/     # API call functions (no React, no JSX)
  utils/        # pure helpers (no React, no API calls, no side effects)
  <FeatureName>.tsx          # root component
  <FeatureName>.module.scss  # scoped styles
  <featureName>Slice.ts      # Redux slice (per feature)
```

- Never put backend logic or data transformation in components — delegate to `services/` or `utils/`.
- Scaffold all three folders for a new feature (`.gitkeep` if empty).
- Design system: **Mantine** components; SCSS modules for styling; Canvas-based custom rendering for performance-critical visualizations (waveform/spectrogram).
- Reference docs: Mantine `https://mantine.dev/llms.txt`, React patterns `https://www.patterns.dev/react/`.

## Agent / AI validation rules

The AI agent is a junior acoustic-engineer copilot, not a generic chatbot. It must:

1. Only explain evidence the backend provides.
2. Never invent frequencies, levels, metrics, or causes.
3. Include uncertainty when warranted; distinguish measured facts from hypotheses.
4. Suggest next steps grounded in the evidence.
5. Be concise but useful — non-expert-friendly or engineer-technical on request.

Pipeline (never let the LLM derive conclusions from raw audio):

```
Audio file → deterministic DSP modules → structured evidence JSON
          → findings engine → LLM → explanation / report / suggestions
```

## Scientific integrity (do not fake analysis)

- Never hardcode fake metrics or fabricate findings/values.
- Add tests for calculation logic and for data contracts.
- Make analysis parameters explicit; use names understandable to acoustic engineers.
- If a calculation, standard, or algorithm is not clearly specified, do NOT pretend it is known. Add a clearly-marked assumption, a `// TODO:` citing the standard to confirm, or implement a minimal documented version. Example:

```csharp
// TODO: Confirm whether CPB should follow IEC 61260 exact band definitions.
// Current implementation uses nominal 1/3-octave center frequencies.
```

- Don't add large dependencies without explaining why.

## How to respond to a FEATURE request

Reply with, in order:
1. Brief product interpretation
2. User story
3. Acceptance criteria
4. Backend tasks
5. Frontend tasks
6. Data contracts
7. Tests
8. Edge cases
9. Suggested implementation order
10. Assumptions / open questions

## How to respond to a CODE request

- Keep it aligned with the architecture above; build a thin vertical slice.
- Avoid unnecessary abstractions; use clear names; include tests where appropriate.
- No placeholder/fake analysis values; document assumptions.

## How to respond to a SPRINT-PLANNING request

- Break work into small stories prioritized for end-to-end value.
- Identify blockers and technical risks; propose a realistic sprint goal with a Definition of Done.

## Roadmap context (so suggestions align with the North Star)

North star: help engineers understand, compare, and improve sound faster via trustworthy
DSP + batch benchmarking + evidence-based AI investigation. High-value, not-yet-done areas:
sound-quality metrics (loudness/sharpness/roughness), **batch benchmarking** (10→100 files,
ranking/clustering/outliers), the investigation workspace, and grounded **report generation**.
Keep the product narrow — it is not a DAW, generic audio editor, or generic chatbot.
