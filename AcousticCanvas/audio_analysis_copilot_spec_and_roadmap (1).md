# Audio Analysis Copilot — Product Spec and Skinny-Branch Roadmap

## 0. One-line product definition

A professional audio-analysis workspace with two modes: a manual analysis mode for direct expert inspection, and an agent mode where an AI assistant operates the same deterministic DSP tools, updates the workspace, explains findings, and generates reproducible reports.

The AI does not directly “judge” raw audio. It receives structured data from the DSP backend and may only make technical claims traceable to tool outputs.

---

## 1. Product principles

### 1.1 Manual mode is the source of truth

The app must be useful without the AI.

Manual mode should support direct interaction:

- import audio
- playback
- waveform view
- spectrogram view
- spectrum view
- selection
- zoom
- loop
- markers
- analysis cards

The expert user should never feel forced into chat.

### 1.2 Agent mode is acceleration, not replacement

Agent mode should:

- inspect the current project state
- call backend analysis modules
- update the workspace visually
- add markers
- open views
- explain results
- generate summaries and reports

It should not become a vague chatbot that makes unsupported subjective claims.

### 1.3 DSP backend is evidence

All technical claims must come from deterministic analysis outputs.

Examples:

| Agent claim | Required backend evidence |
|---|---|
| “This file clips” | clipping detector result |
| “B is brighter than A” | normalized spectral or band-energy comparison |
| “This transient is sharper” | transient analysis |
| “This section is mostly mono” | stereo correlation / mid-side metrics |
| “There is a likely click here” | event detector result |

### 1.4 Few agent tools, many analyzers

Do not expose every DSP feature as an individual agent tool.

Use a small stable agent API:

```ts
getState()
analyze()
compare()
find()
workspace()
report()
```

Behind that API, grow the DSP backend with analyzer modules.

### 1.5 Every important result should be reproducible

Every analysis result should store:

- input file IDs
- selected regions
- analysis type
- parameters
- output summary
- timestamp
- source action: manual or agent

A user should be able to click an agent claim and see the supporting analysis card.

---

## 2. Target users

### 2.1 Primary v1 users

#### Audio software engineers / DSP developers

Jobs to be done:

- compare input/output files
- inspect plugin or algorithm changes
- detect clipping, level changes, spectral changes, transient changes
- create regression-style analysis reports

#### Sound designers / technical audio designers

Jobs to be done:

- compare samples
- find harsh, bright, boomy, clicky, noisy, or clipped assets
- batch-check asset consistency
- understand what makes two sounds different

### 2.2 Secondary users

#### Audio educators / students

Jobs to be done:

- understand FFT, spectrogram, clipping, transients, loudness, stereo width
- ask questions about selected regions
- connect audio terminology with measurable properties

#### Podcast / dialogue editors

Jobs to be done:

- inspect noise, silence, clicks, level problems
- find loudest or problematic regions
- generate QA summaries

---

## 3. Scope boundaries

### 3.1 In scope for MVP

- single-file inspection
- two-file A/B comparison
- deterministic analysis cards
- waveform view
- spectrogram view
- spectrum view
- playback and loop
- selection and markers
- agent querying current state
- agent calling analysis modules
- agent adding markers and opening views
- markdown report generation

### 3.2 Not in scope for MVP

- destructive editing
- multitrack DAW timeline
- plugin hosting
- AI mastering
- source separation
- music generation
- forensic authenticity claims
- advanced MIR such as key/chord detection
- full podcast editing workflow
- mobile app
- collaborative editing

---

## 4. Core UI modes

## 4.1 Manual Analysis Mode

Manual Analysis Mode is the expert-first workspace.

Required UI panels:

- file list
- transport
- waveform
- spectrogram
- spectrum / FFT panel
- inspector panel
- markers / analysis cards panel

Minimum controls:

- play / pause
- seek
- loop selection
- zoom horizontally
- select time region
- switch active file
- add marker
- delete marker
- show spectrum for current selection
- show file metrics

AI should be hidden or collapsed by default in this mode.

## 4.2 Agent Mode

Agent Mode is for delegated investigation.

Required capabilities:

- chat input
- visible task progress
- generated analysis cards
- workspace updates
- clickable evidence links
- final explanation grounded in analysis outputs

Agent Mode may change the workspace, but only through `workspace()` actions.

Examples:

- “Compare A and B.”
- “Why does B sound brighter?”
- “Find clicks.”
- “Find clipping and silence.”
- “Explain this selected region.”
- “Generate a QA report.”

## 4.3 Optional command-bar bridge

A command-bar interaction can bridge manual and agent modes:

```text
Cmd/Ctrl + K → “Explain this selection”
Cmd/Ctrl + K → “Compare with file B”
```

This can come after the core two modes exist.

---

## 5. Core data model

```ts
type Project = {
  id: string;
  name: string;
  files: AudioFile[];
  markers: Marker[];
  regions: Region[];
  analysisResults: AnalysisResult[];
  conversations: ConversationTurn[];
  workspace: WorkspaceState;
  createdAt: string;
  updatedAt: string;
};
```

```ts
type AudioFile = {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  durationSec: number;
  sampleRate: number;
  channels: number;
  bitDepth?: number;
  storageUri: string;
  waveformPeakCacheUri?: string;
  createdAt: string;
};
```

```ts
type Region = {
  id: string;
  fileId: string;
  startSec: number;
  endSec: number;
  label?: string;
};
```

```ts
type Marker = {
  id: string;
  fileId: string;
  timeSec: number;
  label: string;
  severity?: "info" | "low" | "medium" | "high";
  source: "manual" | "agent" | "analysis";
  relatedAnalysisResultId?: string;
  createdAt: string;
};
```

```ts
type AnalysisResult = {
  id: string;
  projectId: string;
  type: string;
  target: AnalysisTarget | ComparisonTarget;
  parameters: Record<string, unknown>;
  summary: AnalysisSummary;
  rawDataUri?: string;
  source: "manual" | "agent";
  createdAt: string;
};
```

```ts
type WorkspaceState = {
  activeFileId?: string;
  activeSelection?: {
    fileId: string;
    startSec: number;
    endSec: number;
  };
  visibleViews: WorkspaceView[];
  playback: {
    fileId?: string;
    positionSec: number;
    isPlaying: boolean;
    loopRegion?: {
      startSec: number;
      endSec: number;
    };
  };
};
```

---

## 6. Stable agent tool API

The agent should only need six top-level tools.

---

## 6.1 `getState()`

Returns current project and workspace state.

### Input

```ts
type GetStateInput = {
  projectId: string;
  include?: Array<
    | "files"
    | "selection"
    | "markers"
    | "workspace"
    | "recent_analysis"
    | "capabilities"
  >;
};
```

### Output

```ts
type GetStateOutput = {
  project: {
    id: string;
    name: string;
  };
  files: AudioFileSummary[];
  activeSelection?: RegionLike;
  markers?: Marker[];
  workspace?: WorkspaceState;
  recentAnalysis?: AnalysisResult[];
  capabilities: CapabilityRegistry;
};
```

---

## 6.2 `analyze()`

Runs one or more analysis modules on a file or region.

### Input

```ts
type AnalyzeInput = {
  projectId: string;
  target: {
    fileId: string;
    region?: {
      startSec: number;
      endSec: number;
    };
    channelMode?: "mono_sum" | "left" | "right" | "mid" | "side" | "stereo";
  };
  kinds: AnalysisKind[];
  options?: AnalysisOptions;
};
```

### Initial `AnalysisKind`

```ts
type AnalysisKind =
  | "file_info"
  | "level"
  | "spectrum"
  | "band_energy"
  | "transient"
  | "stereo";
```

### Output

```ts
type AnalyzeOutput = {
  results: AnalysisResult[];
};
```

---

## 6.3 `compare()`

Compares two or more files or regions.

### Input

```ts
type CompareInput = {
  projectId: string;
  targets: Array<{
    fileId: string;
    region?: {
      startSec: number;
      endSec: number;
    };
  }>;
  kinds: AnalysisKind[];
  options?: {
    normalize?: "none" | "peak" | "rms" | "loudness";
    align?: "none" | "onset" | "cross_correlation";
    channelMode?: "mono_sum" | "stereo" | "mid_side";
  };
};
```

### Output

```ts
type CompareOutput = {
  result: AnalysisResult;
};
```

---

## 6.4 `find()`

Searches for events or anomalies.

### Input

```ts
type FindInput = {
  projectId: string;
  target: {
    fileId: string;
    region?: {
      startSec: number;
      endSec: number;
    };
  };
  kinds: EventKind[];
  options?: {
    maxResults?: number;
    sensitivity?: "low" | "medium" | "high";
    minDurationMs?: number;
    thresholdDb?: number;
  };
};
```

### Initial `EventKind`

```ts
type EventKind =
  | "clip"
  | "near_clip"
  | "silence"
  | "click_candidate"
  | "loudest_region"
  | "transient";
```

### Output

```ts
type FindOutput = {
  events: AudioEvent[];
  analysisResultId: string;
};
```

---

## 6.5 `workspace()`

Updates the visual workspace.

### Input

```ts
type WorkspaceInput = {
  projectId: string;
  actions: WorkspaceAction[];
};
```

### Initial action types

```ts
type WorkspaceAction =
  | {
      type: "set_active_file";
      fileId: string;
    }
  | {
      type: "set_selection";
      fileId: string;
      startSec: number;
      endSec: number;
    }
  | {
      type: "open_view";
      view: "waveform" | "spectrogram" | "spectrum" | "comparison" | "report";
      fileId?: string;
      region?: { startSec: number; endSec: number };
      options?: Record<string, unknown>;
    }
  | {
      type: "add_marker";
      fileId: string;
      timeSec: number;
      label: string;
      severity?: "info" | "low" | "medium" | "high";
      relatedAnalysisResultId?: string;
    }
  | {
      type: "loop_region";
      fileId: string;
      startSec: number;
      endSec: number;
    }
  | {
      type: "highlight_frequency_band";
      lowHz: number;
      highHz: number;
      label?: string;
    };
```

---

## 6.6 `report()`

Generates a project or comparison report.

### Input

```ts
type ReportInput = {
  projectId: string;
  format: "markdown" | "json";
  include: Array<
    | "file_info"
    | "markers"
    | "analysis_results"
    | "comparisons"
    | "agent_summary"
  >;
};
```

### Output

```ts
type ReportOutput = {
  reportId: string;
  format: "markdown" | "json";
  content: string;
};
```

---

## 7. Analyzer module architecture

Use plugin-like backend analyzers.

```ts
type AnalyzerModule = {
  id: string;
  kind: AnalysisKind | EventKind;
  displayName: string;
  description: string;
  inputType: "file" | "region" | "comparison";
  outputType: "summary" | "events" | "series" | "matrix";
  defaultOptions: Record<string, unknown>;
  run(input: AnalyzerInput): Promise<AnalyzerOutput>;
};
```

Initial modules:

| Module | Purpose | MVP priority |
|---|---|---|
| `file_info` | duration, sample rate, channel count | P0 |
| `level` | peak, RMS, crest factor, DC offset | P0 |
| `spectrum` | average FFT for current region | P0 |
| `band_energy` | energy in named frequency bands | P0 |
| `transient` | attack, peak timing, rough sharpness | P1 |
| `stereo` | correlation, mid/side balance | P1 |
| `clip` | clipped and near-clipped samples | P0 |
| `silence` | leading/trailing/internal silence | P1 |
| `click_candidate` | suspicious short broadband transients | P2 |
| `loudest_region` | loudest window search | P1 |

---

## 8. Analysis output shapes

## 8.1 Level summary

```json
{
  "type": "level",
  "summary": {
    "peakDbfs": -0.2,
    "rmsDbfs": -18.4,
    "crestFactorDb": 18.2,
    "dcOffset": 0.0003
  }
}
```

## 8.2 Band energy summary

```json
{
  "type": "band_energy",
  "summary": {
    "bands": [
      { "name": "sub", "lowHz": 20, "highHz": 80, "energyDb": -21.4 },
      { "name": "low_mid", "lowHz": 150, "highHz": 400, "energyDb": -24.2 },
      { "name": "presence", "lowHz": 2000, "highHz": 5000, "energyDb": -31.1 },
      { "name": "air", "lowHz": 8000, "highHz": 16000, "energyDb": -39.8 }
    ]
  }
}
```

## 8.3 Comparison summary

```json
{
  "type": "comparison",
  "summary": {
    "normalization": "rms",
    "findings": [
      {
        "label": "B has more high-frequency energy",
        "evidence": "B is +4.8 dB from 5–12 kHz after RMS matching",
        "confidence": "high",
        "relatedView": "spectrum_comparison"
      }
    ]
  }
}
```

## 8.4 Event result

```json
{
  "type": "events",
  "events": [
    {
      "kind": "click_candidate",
      "fileId": "file_a",
      "timeSec": 1.203,
      "durationMs": 7,
      "severity": "medium",
      "confidence": 0.82,
      "evidence": {
        "broadbandEnergyIncreaseDb": 14.2,
        "localWindowMs": 50
      }
    }
  ]
}
```

---

## 9. Agent behavior rules

### 9.1 Allowed agent behavior

The agent may:

- request current state
- run analyses
- compare files
- find events
- add markers
- open views
- highlight frequency bands
- loop regions
- generate reports
- explain findings

### 9.2 Disallowed agent behavior in MVP

The agent may not:

- modify raw audio destructively
- export or share files without explicit user request
- claim certainty for subjective qualities
- invent analysis results
- pretend unsupported analyzers exist

### 9.3 Language style

The agent should say:

- “The measurable evidence suggests…”
- “A likely reason is…”
- “This may correspond to perceived brightness because…”
- “I do not have a dedicated detector for that yet, but I can inspect related features.”

The agent should avoid:

- “This objectively sounds bad.”
- “This is definitely professional.”
- “The problem is 250 Hz.”

### 9.4 Claim confidence levels

Every nontrivial agent conclusion should be classified internally as:

- observed
- inferred
- speculative

Example:

```text
Observed: B has +4.8 dB energy in 5–12 kHz after RMS matching.
Inferred: This likely contributes to perceived brightness.
Speculative: On some playback systems this may feel harsh.
```

---

## 10. MVP user stories

## 10.1 Single-file inspection

As a user, I can import one audio file, play it, view waveform and spectrogram, select a region, and inspect its spectrum.

Acceptance criteria:

- user can import WAV at minimum
- waveform renders
- playback works
- selection works
- spectrum updates from selected region
- file metrics are visible

## 10.2 Explain selected region

As a user, I can select a region and ask the agent to explain it.

Acceptance criteria:

- agent reads current selection
- agent calls `analyze()` with relevant modules
- agent explains using returned data
- an analysis card is created
- user can click the card and see parameters

## 10.3 A/B comparison

As a user, I can import two files and ask why they differ.

Acceptance criteria:

- two files can be loaded
- user can set A and B
- agent calls `compare()`
- comparison can use RMS normalization
- spectrum or band-energy difference is shown
- agent summary includes evidence

## 10.4 Defect finding

As a user, I can ask the agent to find clipping, silence, or click candidates.

Acceptance criteria:

- agent calls `find()`
- events are returned
- markers are added
- workspace zooms to strongest event
- agent explains what was found

## 10.5 Report generation

As a user, I can generate a markdown report of the current project.

Acceptance criteria:

- report includes file info
- report includes markers
- report includes analysis results
- report includes agent summary
- report can be copied or downloaded

---

## 11. Suggested technical stack

This is a suggested stack, not a hard requirement.

### Frontend

- TypeScript
- React or similar UI framework
- Web Audio API for playback
- Canvas/WebGL for waveform and spectrogram rendering
- Web Workers for local computation where useful

### Backend

- Python/FastAPI or Node/TypeScript
- FFmpeg for decoding and normalization pipeline
- NumPy/SciPy/librosa-style primitives for prototype analysis
- object storage for uploaded files and cached raw outputs
- SQLite/Postgres for project metadata

### Agent layer

- tool-calling LLM API
- strict JSON schemas
- stateful project context
- analysis-result grounding
- no direct raw-audio claims without DSP output

---

# 12. Skinny-branch roadmap

Each branch should be small, mergeable, and demoable.

Rule of thumb: every branch should answer one question:

> “What user-visible capability did this add?”

Avoid branches like `build-audio-engine` or `agent-system`. Those are too fat.

---

## Phase 0 — Project skeleton

### Branch 0.1 — `app-shell`

Goal: Create the empty application shell.

Scope:

- app layout
- top nav
- mode switch: Manual / Agent
- placeholder panels
- empty project state

Acceptance criteria:

- app launches
- user can switch Manual / Agent tabs
- no audio functionality yet

---

### Branch 0.2 — `project-state-store`

Goal: Add a typed project/workspace state store.

Scope:

- `Project`
- `AudioFile`
- `Region`
- `Marker`
- `AnalysisResult`
- `WorkspaceState`

Acceptance criteria:

- state can store files, active selection, markers, visible views
- test fixtures exist
- state can be serialized to JSON

---

## Phase 1 — Audio import and playback

### Branch 1.1 — `audio-file-import-wav`

Goal: Import a WAV file into the project.

Scope:

- file picker / drag-drop
- decode audio metadata
- add file to project state
- show file name, duration, sample rate, channel count

Acceptance criteria:

- user can import one WAV file
- file appears in file list
- metadata appears in inspector

---

### Branch 1.2 — `audio-playback-basic`

Goal: Play and pause imported audio.

Scope:

- NAudio
- play/pause button
- seek position state
- basic transport UI

Acceptance criteria:

- user can play imported file
- user can pause
- playback position updates

---

### Branch 1.3 — `waveform-peaks-render`

Goal: Render a basic waveform.

Scope:

- compute peak cache
- draw waveform to canvas
- support mono sum initially

Acceptance criteria:

- waveform appears after import
- waveform width adapts to panel
- playback cursor is visible

---

### Branch 1.4 — `selection-and-loop`

Goal: Add region selection and loop playback.

Scope:

- click-drag selection on waveform
- store active selection in workspace state
- loop selected region

Acceptance criteria:

- user can select a region
- selected region is visible
- loop playback repeats the selection

---

## Phase 2 — Manual analysis MVP

### Branch 2.1 — `analysis-module-file-info-level`

Goal: Add first backend/local analysis modules.

Scope:

- `file_info`
- `level`
- peak dBFS
- RMS dBFS
- crest factor
- DC offset

Acceptance criteria:

- analysis can run on whole file
- analysis result is stored as `AnalysisResult`
- inspector shows level metrics

---

### Branch 2.2 — `analysis-cards`

Goal: Display analysis results as reproducible cards.

Scope:

- card list UI
- analysis type
- target file/region
- parameters
- summary
- timestamp

Acceptance criteria:

- running level analysis creates a card
- card can be expanded to show details

---

### Branch 2.3 — `spectrum-selected-region`

Goal: Show FFT spectrum for selected region.

Scope:

- `spectrum` analyzer
- selected-region average spectrum
- spectrum canvas
- window size option, hardcoded default acceptable

Acceptance criteria:

- user selects region
- spectrum renders for that region
- analysis card stores parameters

---

### Branch 2.4 — `spectrogram-basic`

Goal: Add basic spectrogram view.

Scope:

- STFT computation
- spectrogram rendering
- log-frequency option can wait
- cache result per file

Acceptance criteria:

- spectrogram renders for imported file
- user can visually align waveform and spectrogram

---

## Phase 3 — Stable internal tool API

### Branch 3.1 — `tool-get-state`

Goal: Implement `getState()` as a local tool function.

Scope:

- return project summary
- active file
- selection
- visible views
- available capabilities

Acceptance criteria:

- test call returns valid JSON
- output does not include raw audio buffers

---

### Branch 3.2 — `tool-analyze`

Goal: Implement generic `analyze()` dispatcher.

Scope:

- supports `file_info`
- supports `level`
- supports `spectrum`
- stores `AnalysisResult`

Acceptance criteria:

- one API can run multiple analysis kinds
- results are normalized to common shape

---

### Branch 3.3 — `tool-workspace`

Goal: Implement generic workspace actions.

Scope:

- set active file
- set selection
- open view
- add marker
- loop region

Acceptance criteria:

- tool call can change workspace state
- UI updates from workspace state

---

### Branch 3.4 — `capability-registry`

Goal: Expose available analyzers and event detectors.

Scope:

- registry of analysis kinds
- registry of event kinds
- human-readable descriptions
- default options

Acceptance criteria:

- `getState()` returns capability registry
- unsupported kinds are rejected clearly

---

## Phase 4 — Agent v0

### Branch 4.1 — `agent-chat-panel`

Goal: Add a chat panel in Agent Mode.

Scope:

- chat messages
- input box
- assistant placeholder response
- conversation stored in project state

Acceptance criteria:

- user can type message
- assistant response appears
- conversation persists in current project state

---

### Branch 4.2 — `agent-tool-runner-local`

Goal: Add local tool-calling loop without external LLM dependency.

Scope:

- mock planner for fixed commands
- routes commands to `getState`, `analyze`, `workspace`

Acceptance criteria:

- “show file info” runs `getState` and `analyze`
- “mark current time” runs `workspace`
- useful for testing tool contracts

---

### Branch 4.3 — `agent-llm-tool-calling`

Goal: Connect real LLM tool calling.

Scope:

- system prompt
- tool schemas
- tool execution
- final response generation
- error handling

Acceptance criteria:

- agent can answer “What file is loaded?”
- agent can run `analyze()`
- agent cannot access raw audio directly

---

### Branch 4.4 — `agent-explain-selection`

Goal: First real useful agent workflow.

Scope:

- user selects region
- asks “explain this selection”
- agent runs `analyze()` with level and spectrum
- agent returns grounded explanation

Acceptance criteria:

- analysis card is created
- answer cites measured values
- answer mentions uncertainty for subjective interpretation

---

## Phase 5 — A/B comparison

### Branch 5.1 — `multi-file-import`

Goal: Support multiple files in one project.

Scope:

- file list
- active file switching
- per-file playback
- per-file waveform cache

Acceptance criteria:

- user can import at least two files
- user can switch active file
- waveform updates correctly

---

### Branch 5.2 — `compare-tool-level-band-energy`

Goal: Implement first `compare()` function.

Scope:

- compare two files or regions
- RMS normalization option
- level comparison
- band-energy comparison

Acceptance criteria:

- comparison result is stored
- summary includes measured differences

---

### Branch 5.3 — `comparison-view`

Goal: Add visual comparison UI.

Scope:

- side-by-side file labels
- level comparison table
- band-energy difference table
- optional spectrum overlay

Acceptance criteria:

- user can view comparison result
- agent can open comparison view through `workspace()`

---

### Branch 5.4 — `agent-compare-ab`

Goal: Agent can answer “compare A and B.”

Scope:

- agent selects two files from project
- calls `compare()`
- opens comparison view
- summarizes evidence

Acceptance criteria:

- answer includes normalization setting
- answer includes at least three measured differences when available
- answer avoids unsupported aesthetic judgment

---

### Branch 5.5 — `agent-why-brighter`

Goal: Specialized but still generic brightness workflow.

Scope:

- agent maps “brighter” to high-frequency band energy and spectral centroid-style summary
- calls `compare()` with `band_energy` and `spectrum`
- highlights relevant frequency band

Acceptance criteria:

- agent can answer “Why does B sound brighter?”
- response is grounded in 5–12 kHz / high-band comparison
- comparison view highlights high band

---

## Phase 6 — Event finding

### Branch 6.1 — `find-tool-clipping`

Goal: Implement `find()` for clipping and near-clipping.

Scope:

- detect consecutive clipped samples
- detect near-clip threshold
- return event list

Acceptance criteria:

- clipped test file returns events
- events include time, severity, confidence/evidence

---

### Branch 6.2 — `agent-find-clipping`

Goal: Agent can find clipping and mark it.

Scope:

- agent calls `find({ kinds: ["clip", "near_clip"] })`
- agent adds markers through `workspace()`
- agent opens waveform around strongest event

Acceptance criteria:

- markers appear at clipped regions
- agent explains number and severity of events

---

### Branch 6.3 — `find-tool-silence-loudest-region`

Goal: Add silence and loudest-region detectors.

Scope:

- leading silence
- trailing silence
- internal silence over threshold duration
- loudest short window

Acceptance criteria:

- test files return expected silence regions
- loudest region can be marked and looped

---

### Branch 6.4 — `agent-find-basic-issues`

Goal: Agent can run a basic QA pass.

Scope:

- clipping
- near clipping
- silence
- loudest region
- level metrics

Acceptance criteria:

- user can ask “check this file for basic issues”
- agent adds markers
- agent creates summary analysis card

---

### Branch 6.5 — `find-tool-click-candidate`

Goal: Add first heuristic click detector.

Scope:

- short broadband transient candidate detection
- local energy contrast
- max results and sensitivity options

Acceptance criteria:

- synthetic click test returns candidate
- false positives are acceptable but marked as “candidate”
- agent wording remains cautious

---

## Phase 7 — Reporting

### Branch 7.1 — `report-tool-markdown`

Goal: Implement `report()` markdown output.

Scope:

- file info
- analysis results
- markers
- comparison summaries

Acceptance criteria:

- report content is generated from project state
- no hallucinated analysis appears

---

### Branch 7.2 — `report-view`

Goal: Add report UI.

Scope:

- report panel
- copy markdown
- download markdown

Acceptance criteria:

- user can generate report manually
- user can copy or download markdown

---

### Branch 7.3 — `agent-generate-report`

Goal: Agent can generate a report on request.

Scope:

- agent calls `report()`
- opens report view
- summarizes what was included

Acceptance criteria:

- “generate a QA report” works
- report includes all available analysis evidence

---

## Phase 8 — Polish and trust

### Branch 8.1 — `clickable-agent-evidence`

Goal: Make agent claims link to evidence.

Scope:

- agent response references analysis result IDs
- UI renders evidence links
- clicking opens analysis card or relevant view

Acceptance criteria:

- user can click a claim and see supporting analysis

---

### Branch 8.2 — `unsupported-capability-handling`

Goal: Agent gracefully handles missing analyzers.

Scope:

- unsupported requests produce honest response
- agent suggests closest available analysis

Acceptance criteria:

- asking for unsupported feature does not hallucinate
- response lists what can be inspected instead

---

### Branch 8.3 — `analysis-parameter-visibility`

Goal: Make analysis settings transparent.

Scope:

- show FFT size
- show window type
- show normalization mode
- show region
- show channel mode

Acceptance criteria:

- every card exposes parameters
- agent responses mention important defaults

---

### Branch 8.4 — `cache-analysis-results`

Goal: Avoid recomputing identical analyses.

Scope:

- hash analysis input
- reuse matching result
- indicate cached result

Acceptance criteria:

- repeated spectrum analysis reuses cached result
- cache invalidates correctly when parameters change

---

## Phase 9 — Batch/asset workflows

### Branch 9.1 — `batch-import-folder`

Goal: Support importing many files.

Scope:

- multi-file drag/drop
- file table
- basic metadata for all files

Acceptance criteria:

- user can import 20+ files
- app remains usable

---

### Branch 9.2 — `batch-level-analysis`

Goal: Run level analysis across many files.

Scope:

- batch job runner
- progress state
- results table

Acceptance criteria:

- user can analyze all files for peak/RMS/crest
- table can sort by metric

---

### Branch 9.3 — `batch-basic-qa`

Goal: Run clipping/silence QA across many files.

Scope:

- batch `find()`
- issue count per file
- issue table

Acceptance criteria:

- user can see which files have clipping or silence issues
- clicking an issue opens that file and region

---

### Branch 9.4 — `agent-batch-qa`

Goal: Agent can QA a folder.

Scope:

- agent runs batch QA
- summarizes outliers
- opens issue table
- generates report

Acceptance criteria:

- “check these files for clipping and silence” works
- report includes per-file findings

---

# 13. Suggested release milestones

## Milestone A — Manual inspection prototype

Includes:

- branches 0.1–2.5

Demo:

- import WAV
- play
- view waveform/spectrogram
- select region
- inspect spectrum
- create markers

This proves the app is useful without AI.

---

## Milestone B — Agent v0 grounded analysis

Includes:

- branches 3.1–4.4

Demo:

- select a region
- ask “explain this selection”
- agent runs analysis
- agent produces grounded explanation
- analysis card is created

This proves the AI architecture.

---

## Milestone C — A/B comparison demo

Includes:

- branches 5.1–5.5

Demo:

- import A and B
- ask “why does B sound brighter?”
- agent compares using RMS normalization
- opens comparison view
- highlights frequency band
- cites evidence

This is the strongest early demo.

---

## Milestone D — QA assistant demo

Includes:

- branches 6.1–7.3

Demo:

- ask “check this file for basic issues and make a report”
- agent finds clipping/silence/loudest region
- adds markers
- generates markdown report

This is the first monetizable workflow.

---

## Milestone E — Trust and batch workflows

Includes:

- branches 8.1–9.4

Demo:

- batch import files
- agent runs basic QA
- issue table appears
- report generated
- all claims link to analysis evidence

This starts becoming a product instead of a demo.

---

# 14. Testing strategy

## 14.1 Synthetic audio fixtures

Create generated test files:

- sine wave
- silence
- clipped sine
- stereo phase inversion
- impulse click
- noise burst
- file with leading/trailing silence
- two files with known high-frequency boost
- two files with known level difference

## 14.2 Analyzer tests

Each analyzer should have tests with known expected properties.

Examples:

- clipped file returns clipping events
- silent file returns silence event
- boosted file has higher high-band energy
- phase-inverted stereo file has negative correlation

## 14.3 Agent tests

Use deterministic mocked LLM or recorded tool plans.

Test that the agent:

- calls tools instead of inventing results
- refuses unsupported analyzers
- cites analysis IDs in claims
- uses cautious language for subjective terms

---

# 15. Main risks and mitigations

## Risk: Tool explosion

Mitigation:

- keep six top-level tools
- grow analyzer modules behind `analyze`, `compare`, and `find`

## Risk: AI hallucination

Mitigation:

- no technical claims without analysis result
- evidence links
- capability registry
- unsupported-feature handling

## Risk: App becomes a DAW

Mitigation:

- no destructive editing in MVP
- no multitrack timeline
- focus on inspection, comparison, and QA

## Risk: Analysis is too slow

Mitigation:

- cache analysis results
- use progressive rendering
- limit default analysis regions
- batch jobs for long-running workflows

## Risk: Subjective audio terms are ambiguous

Mitigation:

- map subjective terms to measurable hypotheses
- use cautious language
- show multiple possible causes

---

# 16. First implementation recommendation

Build in this order:

1. Manual app shell
2. Import/playback/waveform
3. Selection/spectrum/spectrogram
4. Analysis result cards
5. Generic tool API
6. Agent explain-selection
7. A/B comparison
8. Agent A/B explanation
9. Clipping/silence detection
10. Report generation
11. Batch QA

The first serious demo should be:

> Import two kick drums, ask “why does B sound brighter?”, watch the agent run a normalized comparison, open the spectrum view, highlight the high-frequency band, and produce a grounded explanation with a reproducible analysis card.

