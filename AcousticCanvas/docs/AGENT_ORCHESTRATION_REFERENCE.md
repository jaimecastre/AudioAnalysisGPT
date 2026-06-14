# AcousticGPT Agent Orchestration Implementation Prompt

You are my senior software architect and implementation assistant for AcousticGPT.

AcousticGPT is an AI-assisted sound analysis platform with:

- Frontend: React
- Backend: C#
- DSP/analysis modules: C# first, optional Python sidecar for specific libraries such as MoSQITo
- Agent layer: OpenAI API

The goal is to implement an **evidence-based agent orchestration workflow**.

The OpenAI API should not directly invent conclusions about audio. Instead, it should understand the user request, decide which analysis tools are needed, trigger deterministic DSP modules through the backend, receive structured JSON evidence, and then generate a grounded final answer.

---

# Core Architecture

Implement this workflow:

```text
User asks natural-language question
    ↓
React sends question + selected file/project context to C# backend
    ↓
C# AgentOrchestrator calls OpenAI as planner
    ↓
OpenAI decides which analysis tools are needed
    ↓
C# validates requested tool calls
    ↓
C# executes DSP/analysis modules
    ↓
DSP modules return structured JSON evidence
    ↓
C# builds compact EvidencePackage
    ↓
C# sends EvidencePackage back to OpenAI
    ↓
OpenAI generates final grounded answer
    ↓
React displays answer + evidence + suggested next step
```

Important:

* OpenAI understands intent and plans analysis.
* C# backend executes analysis.
* DSP modules produce numeric truth.
* OpenAI explains the evidence.
* The frontend never fabricates metrics.
* The agent must not make unsupported claims.

---

# Key Design Rule

Do not build:

```text
User question → OpenAI guesses answer
```

Build:

```text
User question
→ OpenAI decides what data is needed
→ backend runs tools
→ backend returns evidence
→ OpenAI explains evidence
```

The agent should behave like an acoustic investigation copilot.

The next strategic direction is **AI-generated acoustic visual analysis with expert visualization planning**. The agent should not simply answer with text next to plots. It should decide whether the user needs text only, statistics, plots, charts, rankings, tables, investigation cards, reports, or combinations; choose deterministic DSP tools; specify what data should be visualized; configure axes, units, scales, ranges, legends, annotations, markers, and metadata; and then explain the engineering meaning.

Trust boundary:

```text
LLM plans.
DSP backend computes.
Frontend renders.
LLM explains.
```

The LLM may plan tools, response blocks, visual specifications, overlays, zoom ranges, annotations, and explanations. It must never fabricate SPL, dBFS, RMS, peak, FFT peak, frequency, loudness, sharpness, roughness, tonality, source contribution, ranking, statistic, or chart data values.

---

# When To Use The Agent Workflow

Use agent orchestration when the user asks natural-language questions such as:

* "Why does this sound harsh?"
* "Compare Product A and Product B."
* "Is there clipping?"
* "What is different between these recordings?"
* "Which file sounds more annoying?"
* "What should I analyze next?"
* "Summarize this recording."
* "Generate a report."
* "Why is Product B sharper than Product A?"

Do not use OpenAI when the user simply clicks a manual analysis button.

Manual analysis should follow:

```text
React → C# DSP module → Result → React
```

Example:

* User clicks "Run Spectrum"
* User clicks "Run CPB"
* User clicks "Run Spectrogram"

No OpenAI is needed for direct manual actions.

---

# Backend Responsibilities

The C# backend must own:

* Agent orchestration
* Tool validation
* DSP execution
* Evidence packaging
* OpenAI API calls
* Result caching
* Project/file context
* Error handling
* Guardrails

The backend must prevent OpenAI from directly executing arbitrary operations.

The model may request tools, but the backend decides whether those tool calls are allowed.

---

# Existing Backend Context

The following analysis endpoints already exist and are production-ready:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/audio/upload` | Upload audio file |
| `GET /api/analysis?fileId={id}` | Level analysis (peak, RMS, crest factor, clipping, DC offset) |
| `POST /api/analysis/spectrum` | FFT spectrum |
| `POST /api/analysis/spectrogram` | STFT spectrogram |
| `POST /api/analysis/compare` | Multi-file comparison + band energy deltas |
| `POST /api/analysis/find` | Event detection (clipping, silence, transient, loudest) |
| `POST /api/analysis/findings` | Structured findings engine |
| `POST /api/analysis/cpb` | CPB / octave band analysis |
| `POST /api/analysis/run` | Agent-friendly DSP summary (existing LLM prep) |
| `POST /api/agent/chat` | OpenAI proxy (existing — thin pass-through) |

The new `POST /api/agent/ask` endpoint will replace the thin `POST /api/agent/chat` proxy with a full orchestration flow.

The existing `OpenAiChatService` can be reused by the new `AgentOrchestrator`.

---

# Suggested Backend Structure

Implement or align with this structure inside `Features/Agent/`:

```text
Features/
 └─ Agent/
     ├─ Domain/
     │   └─ ChatModels.cs              ← existing
     ├─ Services/
     │   └─ OpenAiChatService.cs       ← existing — reuse
     ├─ Orchestration/
     │   ├─ AgentOrchestrator.cs       ← NEW
     │   ├─ AgentPlanner.cs            ← NEW
     │   ├─ AgentToolRegistry.cs       ← NEW
     │   ├─ ToolExecutionService.cs    ← NEW
     │   ├─ EvidencePackageBuilder.cs  ← NEW
     │   ├─ AgentResponseValidator.cs  ← NEW
     │   └─ AgentPromptBuilder.cs      ← NEW
     ├─ Commands/
     │   ├─ AgentAskCommand.cs         ← NEW
     │   └─ AgentAskResult.cs          ← NEW
     ├─ Handlers/
     │   └─ AgentAskHandler.cs         ← NEW
     └─ Endpoints/
         ├─ ChatCompletionEndpoint.cs  ← existing
         └─ AgentAskEndpoint.cs        ← NEW
```

Use vertical slice: thin endpoint → handler → orchestrator → planner → tools → evidence → final answer.

Do not break the existing `POST /api/agent/chat` endpoint. Add the new endpoint alongside it.

---

# Main Backend Components

## 1. AgentOrchestrator

Responsible for the full agent flow.

Pseudo-flow:

```csharp
public async Task<AgentAskResult> HandleUserQuestionAsync(
    AgentAskCommand command,
    CancellationToken cancellationToken)
{
    // 1. Load selected file/project context
    // 2. Check existing analysis results (cache — future)
    // 3. Ask OpenAI planner what tools are needed
    // 4. Validate requested tools against AgentToolRegistry
    // 5. Execute allowed tools via ToolExecutionService
    // 6. Build evidence package via EvidencePackageBuilder
    // 7. Ask OpenAI for final grounded response via AgentPlanner
    // 8. Validate response via AgentResponseValidator
    // 9. Return result to frontend
}
```

## 2. AgentPlanner

Responsible for two OpenAI calls:

1. **Planning call** — ask OpenAI what analysis tools are needed for the user question.
2. **Answer call** — ask OpenAI to explain the evidence package.

Input for planning call:
* User question
* Selected file IDs
* Available tool names and descriptions
* Project context

Output for planning call (structured JSON via `response_format: json_object`):

```json
{
  "action": "run_tools",
  "tools": [
    {
      "name": "run_basic_metrics",
      "arguments": {
        "fileIds": ["file_a"]
      }
    }
  ]
}
```

or:

```json
{
  "action": "answer_from_existing_evidence",
  "requiredEvidenceIds": ["ev_123"]
}
```

or:

```json
{
  "action": "ask_clarification",
  "question": "Which file do you want me to check for clipping?"
}
```

Avoid clarification if the selected UI context already provides the answer.

## 3. AgentToolRegistry

A whitelist of allowed tools. Each entry defines:

* Name
* Description
* Input schema
* Output schema
* Max file count
* Whether results can be cached

Allowed tools for Phase 1:

```text
get_metadata
run_basic_metrics
run_spectrum
run_cpb
run_event_detection
```

Do not allow arbitrary code execution. The registry is the gatekeeper.

Future deterministic DSP tools for visual acoustic analysis:

```text
RunBasicStatistics
RunWaveformSummary
RunSpectrum
RunSpectrumOverlay
RunSpectrogram
RunCpbAnalysis
RunLoudness
RunSharpness
RunRoughness
RunTonality
DetectClipping
DetectDominantPeaks
CompareFiles
RankFilesByMetric
ComputeSourceContributions
CompareMeasuredVsPredicted
CompareBeforeAfterProcessing
```

Every tool result should include:

* Result ID
* Tool name
* Tool input parameters
* File ID/name
* Channel
* Time range
* Sample rate
* Units
* Numerical results
* Metadata
* Warnings
* Calibration assumptions

## 4. ToolExecutionService

Responsible for executing approved analysis tools by calling existing backend handlers.

It should:

* Validate inputs against the registry schema
* Check if a cached result exists (future — skip for Phase 1)
* Call the correct existing handler (e.g. `RunAnalysisHandler`, `FindEventsHandler`)
* Return a structured `ToolExecutionOutput` record
* Handle errors clearly and return partial results when possible

## 5. EvidencePackageBuilder

Responsible for converting raw tool outputs into a compact evidence package for the final OpenAI answer.

Do not send full FFT arrays or spectrogram frames to OpenAI.

Send summaries:
* Main peaks
* RMS / peak / crest factor
* Clipping status and sample count
* Highest CPB band differences
* Finding severity and confidence
* Analysis parameters used
* Limitations

Full arrays remain in the backend. Use `dataRef` IDs to reference them.

## 6. AgentResponseValidator

Checks that the final OpenAI answer is acceptable before returning it.

Verify:
* Answer references at least one evidence ID
* Answer does not include standalone numeric values not present in the evidence package
* Answer includes limitations when evidence is incomplete
* Answer does not claim certainty when confidence is low

If validation fails, return the answer with a warning flag rather than blocking the response.

## 7. ExpertVisualizationPlanner

Responsible for deciding the best response format for each user request.

It should decide:

* Whether visualization is needed.
* Which response blocks are needed.
* Which deterministic result references feed each block.
* Whether files/channels/regions should be overlaid or separated.
* Which axes, units, scales, ranges, legends, markers, annotations, highlighted regions, and metadata are required.
* Whether fixed or automatic scaling is appropriate.
* Why each visualization is useful for the question.

If the user asks for "a plot", "graph this", or "show me a chart" without specifying the plot type, infer the best plot from the acoustic intent and include a short reason for the choice. Use spectrum for frequency content, tones, peaks, harmonics, resonances, tonal noise, broadband noise, and spectral differences. Use spectrogram for time variation, transients, tonal drift, and intermittent tones. Use waveform for clipping, transients, edits, or region selection. Use rankings, bar charts, tables, and investigation cards when they answer the user’s question more clearly than a single plot. If multiple views are plausible, choose the safest default and mention the best alternative, or return complementary blocks when both add distinct evidence.

## 8. PlotSpecificationPlanner

Responsible for converting a user question and deterministic result references into precise visualization specifications.

A plot specification should include:

* Plot type
* Data sources/result references
* Selected files
* Selected channels
* Selected time regions
* Selected frequency range or metric set
* Axis labels
* Axis units
* Axis scale
* Axis min/max
* Overlay strategy
* Legend labels
* Annotations
* Peak markers
* Highlighted regions
* Metadata display
* Default zoom/range
* Fixed vs automatic scaling
* Reason for the visualization choice
* Confidence and limitations

The agent should not request “make a plot” generically. It should specify what the plot contains and how it should be displayed.

When choosing among plausible plot types, the plot specification should include a `reason` field that explains why this plot type was selected over alternatives.

## 9. Agent Response Block Model

The agent response is a list of typed blocks, not only a text string.

Suggested block types:

* `MarkdownBlock`
* `StatisticsBlock`
* `SpectrumChartBlock`
* `SpectrumOverlayBlock`
* `SpectrogramChartBlock`
* `WaveformChartBlock`
* `TimeSeriesMetricBlock`
* `RankingBlock`
* `MetricComparisonBlock`
* `PeakTableBlock`
* `ContributionChartBlock`
* `AudioPlayerBlock`
* `SuggestedActionsBlock`
* `InvestigationCardBlock`
* `ReportSummaryBlock`

The frontend must render blocks using trusted acoustic visualization components. The agent must not generate arbitrary React code.

## 10. InvestigationTrace Additions

InvestigationTrace should capture:

* User question
* Interpreted intent
* Selected tools
* Reason for each selected tool
* Tool inputs
* Tool result references
* Selected response blocks
* Visualization specifications
* Reason for each visualization
* Final answer
* Confidence
* Timestamp

This makes the visual plan reproducible and inspectable.

---

# Tool Schemas

Use strict input/output contracts. All types should be C# `record` types.

## run_basic_metrics

Purpose: Compute peak, RMS, crest factor, clipping.

Input:
```json
{
  "fileIds": ["file_a"],
  "clippingThresholdDbFs": -0.1
}
```

Output:
```json
{
  "results": [
    {
      "fileId": "file_a",
      "metrics": {
        "rmsDbFs": -18.4,
        "peakDbFs": -1.2,
        "crestFactorDb": 17.2,
        "clippingDetected": false,
        "clippedSampleCount": 0
      }
    }
  ]
}
```

Maps to: `GET /api/analysis?fileId={id}`

## get_metadata

Purpose: Return file metadata.

Input:
```json
{ "fileIds": ["file_a"] }
```

Output:
```json
{
  "results": [
    {
      "fileId": "file_a",
      "fileName": "ProductA.wav",
      "durationSeconds": 12.4,
      "sampleRateHz": 48000,
      "channels": 1,
      "bitDepth": 24
    }
  ]
}
```

## run_spectrum

Purpose: Compute averaged FFT spectrum.

Input:
```json
{
  "fileIds": ["file_a"],
  "parameters": { "fftSize": 4096, "window": "hann", "overlap": 0.5 }
}
```

Output (summary only — full array stored in backend):
```json
{
  "results": [
    {
      "fileId": "file_a",
      "summary": {
        "dominantPeaks": [
          { "frequencyHz": 685, "magnitudeDb": -32.1, "prominenceDb": 11.2 }
        ]
      },
      "dataRef": "spectrum_result_abc123"
    }
  ]
}
```

Maps to: `POST /api/analysis/spectrum`

## run_cpb

Purpose: Compute octave or 1/3-octave band levels.

Input:
```json
{
  "fileIds": ["file_a"],
  "bandType": "third_octave",
  "weighting": "none"
}
```

Output:
```json
{
  "results": [
    {
      "fileId": "file_a",
      "summary": {
        "highestBands": [
          { "centerFrequencyHz": 1000, "levelDb": 62.3 }
        ]
      },
      "dataRef": "cpb_result_abc123"
    }
  ]
}
```

Maps to: `POST /api/analysis/cpb`

```csharp
// TODO: Current CPB implementation uses FFT-bin power summation.
// This is a nominal approximation, not an IEC 61260 compliant filter bank.
// Label results accordingly in the evidence package.
```

## run_event_detection

Purpose: Detect clipping, silence, or transient events.

Input:
```json
{
  "fileId": "file_a",
  "kind": "clipping"
}
```

Output:
```json
{
  "fileId": "file_a",
  "kind": "clipping",
  "eventCount": 2,
  "events": [
    { "startSeconds": 1.23, "endSeconds": 1.25, "description": "Clipping detected" }
  ]
}
```

Maps to: `POST /api/analysis/find`

---

# Evidence Package

After tools run, `EvidencePackageBuilder` produces this:

```json
{
  "evidencePackageId": "ev_abc123",
  "userQuestion": "Is there clipping?",
  "selectedFiles": ["file_a"],
  "analysesRun": ["run_basic_metrics", "run_event_detection"],
  "keyEvidence": [
    {
      "evidenceId": "ev_clip_1",
      "type": "clipping_result",
      "fileId": "file_a",
      "clippingDetected": true,
      "clippedSampleCount": 14,
      "peakDbFs": -0.02
    }
  ],
  "limitations": [
    "Clipping threshold used: -0.1 dBFS.",
    "Only digital clipping was checked. Analog clipping is not detectable from the digital signal alone."
  ]
}
```

The final OpenAI answer must reference evidence IDs from this package.

---

# Agent Final Response Contract

Return this structure from `POST /api/agent/ask`:

```json
{
  "conversationId": "conv_abc123",
  "answer": "Clipping was detected in file_a. 14 clipped samples were found near the peak of -0.02 dBFS. This indicates the signal reached the digital ceiling during recording or processing.",
  "evidencePackageId": "ev_abc123",
  "evidenceReferences": ["ev_clip_1"],
  "confidence": "high",
  "limitations": [
    "Only digital clipping was checked.",
    "Analog clipping is not detectable from the digital signal."
  ],
  "suggestedNextSteps": [
    "Inspect the waveform at the clipped regions.",
    "Check the loudest region to understand the full dynamic range."
  ],
  "toolExecutions": [
    {
      "toolName": "run_basic_metrics",
      "status": "completed",
      "resultRef": "basic_metrics_file_a"
    },
    {
      "toolName": "run_event_detection",
      "status": "completed",
      "resultRef": "event_detection_file_a"
    }
  ]
}
```

---

# API Endpoint

```http
POST /api/agent/ask
```

Request:

```json
{
  "projectId": "project_123",
  "question": "Is there clipping?",
  "selectedFileIds": ["file_a"],
  "selectedAnalysisResultIds": [],
  "mode": "investigate"
}
```

Do NOT break the existing `POST /api/agent/chat` endpoint.

---

# Agent Behavior Rules

The agent must:

1. Explain only evidence provided by the backend.
2. Never invent frequencies, levels, metrics, causes, or file names.
3. Separate measured facts from hypotheses.
4. Use cautious language for causal claims.
5. Say when evidence is insufficient.
6. Suggest useful next analyses.
7. Reference evidence IDs.
8. Be concise but useful.
9. Be understandable to acoustic engineers.

Good answer:

> "Clipping was detected in ProductA.wav. 14 samples exceeded the -0.1 dBFS threshold, with a peak of -0.02 dBFS. This is consistent with digital saturation during recording or gain staging."

Bad answer:

> "The audio is definitely distorted and will sound terrible."

---

# Planner Prompt System Prompt (for the planning call)

```text
You are the AcousticGPT planning agent.

Your job is to decide which analysis tools are needed to answer the user's question.

Available tools: {toolList}

Selected files: {fileList}

Respond ONLY with valid JSON in this format:

{
  "action": "run_tools",
  "tools": [
    { "name": "<tool_name>", "arguments": { ... } }
  ]
}

Or if no analysis is needed:

{
  "action": "ask_clarification",
  "question": "<question to ask the user>"
}

Rules:
- Select the minimum tools needed.
- Do not request unsupported tools.
- Do not request more files than are selected.
- Do not make up file IDs.
- Prefer run_basic_metrics + run_event_detection for clipping questions.
- Prefer run_spectrum + run_cpb for harshness/spectral questions.
- Do not select tools if the question is conversational only.
```

---

# Planner Examples

## "Is there clipping?"

```json
{
  "action": "run_tools",
  "tools": [
    {
      "name": "run_basic_metrics",
      "arguments": { "fileIds": ["selected_file"] }
    },
    {
      "name": "run_event_detection",
      "arguments": { "fileId": "selected_file", "kind": "clipping" }
    }
  ]
}
```

## "Why does this sound harsh?"

```json
{
  "action": "run_tools",
  "tools": [
    {
      "name": "run_cpb",
      "arguments": { "fileIds": ["selected_file"], "bandType": "third_octave", "weighting": "none" }
    },
    {
      "name": "run_spectrum",
      "arguments": { "fileIds": ["selected_file"], "parameters": { "fftSize": 4096, "window": "hann", "overlap": 0.5 } }
    }
  ]
}
```

## "Summarize this file."

```json
{
  "action": "run_tools",
  "tools": [
    { "name": "get_metadata", "arguments": { "fileIds": ["selected_file"] } },
    { "name": "run_basic_metrics", "arguments": { "fileIds": ["selected_file"] } },
    { "name": "run_spectrum", "arguments": { "fileIds": ["selected_file"], "parameters": { "fftSize": 4096, "window": "hann", "overlap": 0.5 } } }
  ]
}
```

---

# Tool Call Guardrails

The backend must enforce:

* Maximum files per analysis: 10
* Maximum audio duration: 300 seconds per file
* Supported tool names (whitelist only)
* Valid parameter ranges
* Timeouts
* Cancellation token support

Do not trust OpenAI tool arguments blindly. Always validate before executing.

---

# Error Handling

If a tool fails, return partial results with a structured error:

```json
{
  "toolName": "run_event_detection",
  "status": "failed",
  "error": {
    "code": "FILE_NOT_FOUND",
    "message": "File file_a could not be loaded.",
    "recoverable": false
  }
}
```

The agent should be able to answer with partial evidence when one tool fails.

---

# Frontend Requirements (React)

The frontend sends a single request to `POST /api/agent/ask` and displays the structured response.

Needed UI updates:

1. `AgentPanel` sends question + `selectedFileIds` to `/api/agent/ask` instead of building the full tool loop client-side.
2. Display the structured `answer` field.
3. Display `evidenceReferences` as chips/tokens.
4. Display `limitations` below the answer.
5. Display `suggestedNextSteps` as actionable buttons or a list.
6. Display `toolExecutions` as a collapsible "How I analyzed this" section.
7. Show a loading state: "Analyzing request…" while waiting.

The frontend must not fabricate analysis values. It only renders what the backend returns.

---

# Caching Rules (Phase 1 — skip, add TODOs)

Before running a tool:

```csharp
// TODO: Check if an equivalent analysis result already exists for this file + parameters.
// Cache key: fileId + analysisType + parameters hash + module version.
// For Phase 1, always re-run the analysis.
```

---

# Implementation Priority

## Phase 1 — Minimal Agent Orchestrator (implement this first)

Build the vertical slice:

```text
POST /api/agent/ask
  { question: "Is there clipping?", selectedFileIds: ["file_a"] }
  ↓
AgentPlanner → OpenAI planning call → requests run_basic_metrics + run_event_detection
  ↓
AgentToolRegistry validates tool names
  ↓
ToolExecutionService calls RunAnalysisHandler + FindEventsHandler
  ↓
EvidencePackageBuilder builds compact evidence JSON
  ↓
AgentPlanner → OpenAI answer call with evidence package
  ↓
AgentResponseValidator checks references
  ↓
Return AgentAskResult to frontend
  ↓
React displays answer + evidence chips + limitations + next steps
```

This is the first proof of architecture. Everything else builds on top.

## Phase 2 — A/B Comparison

## Phase 3 — Harshness / Spectral Questions

## Phase 4 — Batch Benchmarking

---

# Coding Rules

* Keep OpenAI calls isolated from DSP modules.
* Keep DSP modules deterministic and pure.
* Do not hardcode fake analysis values.
* Do not let the frontend invent metrics.
* Use strongly typed C# `record` types for all contracts.
* Prefer interfaces for analysis modules.
* Make analysis parameters explicit.
* Add `// TODO:` comments for scientific assumptions.
* Keep a thin vertical slice working before expanding.
* Do not over-engineer multi-agent systems yet.
* Follow project code style: long descriptive names, no clever abstractions, single-purpose functions.

---

# Important Scientific Assumption TODOs

```csharp
// TODO: Confirm FFT normalization convention.
// Current implementation returns dBFS magnitude using Hann window coherent-gain correction.
```

```csharp
// TODO: Confirm whether CPB should follow IEC 61260 exact filter-bank behavior.
// Current implementation uses FFT-bin integration and should be labelled as nominal CPB approximation.
```

```csharp
// TODO: Confirm psychoacoustic metric calibration assumptions when MoSQITo sidecar is added.
// MoSQITo requires calibrated pressure signals for physically meaningful Sone/Acum values.
```

---

# Product Goal

> An acoustic investigation copilot that decides what analysis is needed, runs the right tools, inspects the evidence, and explains the result clearly — not a chatbot that guesses things about audio.

Every implementation decision should support this architecture.
