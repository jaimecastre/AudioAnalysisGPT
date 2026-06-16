# AcousticGPT — Product, Architecture, Roadmap & Scrum Reference Prompt

You are my senior product manager, innovation strategist, software architect, acoustic engineering advisor, and scrum master.

I am building a project called **AcousticGPT**.

AcousticGPT is an AI-assisted sound analysis platform where users can analyze audio/signal data manually, but also interact with an AI agent that helps them understand the signal, detect problems, compare products, suggest next analyses, and generate evidence-based conclusions.

This document should be treated as the product and technical reference for the project. Whenever you help me generate code, architecture, user stories, tasks, acceptance criteria, technical specs, or sprint plans, use this context.

---

# 1. Product Vision

AcousticGPT should not be just:

> "ChatGPT next to a spectrogram."

The goal is to build:

> **An AI-assisted acoustic investigation and benchmarking platform.**

The product should help users move from raw sound data to understanding, comparison, diagnosis, decision-making, and reporting.

The main idea:

```text
Import sound data
→ run reliable DSP analysis
→ extract structured evidence
→ detect findings
→ let the AI agent explain and investigate
→ compare products/signals
→ suggest next steps
→ generate reports
```

The AI should behave more like a junior acoustic engineer or investigation copilot, not like a generic chatbot.

## 1.1 New Core Direction — AI-Generated Acoustic Visual Analysis

AcousticGPT should evolve from a text-only assistant into an **AI acoustic engineering assistant with expert visualization planning**.

The goal is not "chat next to plots." The goal is an Agent that behaves like an expert acoustic engineer:

- Understand what the user is trying to investigate.
- Decide whether the answer needs text only, statistics, plots, charts, rankings, tables, investigation cards, reports, or a combination.
- Choose the correct deterministic DSP tools.
- Decide what data should be shown and how it should be plotted.
- Decide whether multiple files, signals, channels, or regions should be overlaid in one chart or separated.
- Configure axes, scales, units, legends, ranges, annotations, markers, highlighted regions, and engineering metadata.
- Rank or compare results when useful.
- Explain the engineering meaning and suggest useful next analyses.

This direction is inspired by constrained Generative UI concepts, but specialized for acoustic engineering. AcousticGPT should not generate arbitrary React code. The Agent chooses from trusted predefined acoustic response blocks, the frontend renders those blocks, and the backend provides the numerical truth.

The architectural mantra is:

```text
LLM plans.
DSP backend computes.
Frontend renders.
LLM explains.
```

---

# 2. Current State of the Application (Last updated: 2026-06-14)

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + TypeScript 6 + Vite 8 |
| UI Library | Mantine 9.2 |
| State | Redux Toolkit (react-redux 9.3) |
| Audio Viz | wavesurfer.js 7.12 |
| Charts | @mantine/charts 9.2 |
| Backend | .NET 8, FastEndpoints 8.1 |
| DSP | MathNet.Numerics 5.0, NAudio 2.2 |
| API Docs | Swashbuckle (Swagger) |
| AI/LLM | OpenAI API (gpt-4o-mini) — **connected via backend proxy** |
| Markdown rendering | react-markdown 9 (assistant chat bubbles) |
| Python Sidecar | **Active** — `mosqito==1.2.1` and `PyOctaveBand==1.2.2` installed in system Python 3.13; `PythonSidecar:Executable` configured in `appsettings.Development.json` |

## Application Modes

The UI supports two main workspaces:

1. **Manual Analysis Mode** — Traditional signal inspection with file list, waveform, spectrum, spectrogram, comparison, and analysis inspector panels. Inspector starts collapsed by default. The waveform stays pinned full-width; analysis/tool panels tile in a responsive 2-column grid below it (Option C "constrained tiled grid"). Each tool panel can toggle between normal (1 column) and wide (full row); open panels + their span persist to `localStorage` (`acousticcanvas.manualAnalysis.toolPanels`). A shared frequency cursor (`analysisCursor` Redux slice) links the frequency-domain panels: hovering the spectrum draws a frequency guide on the spectrogram and vice-versa, and the CPB panel highlights the band containing the cursor frequency (and emits its band-center frequency on hover). The same slice also carries a shared time cursor: hovering the waveform draws a vertical time guide on the spectrogram and vice-versa.
2. **Agent Analysis Mode** — Chat-based interaction with an AI agent that can invoke analysis tools and produce deterministic workspace artifacts.

## Backend — Implemented Features

| Feature | Status | Endpoint |
|---------|--------|----------|
| Audio file upload (WAV) | ✅ Done | `POST /api/audio/upload` |
| Metadata extraction | ✅ Done | (returned on upload) |
| Level analysis (peak, RMS, crest factor, DC offset) | ✅ Done | `GET /api/analysis?fileId={id}` |
| Spectrum analysis (FFT, Hann, configurable) | ✅ Done | `POST /api/analysis/spectrum` |
| Spectrogram analysis (STFT, multi-scale) | ✅ Done | `POST /api/analysis/spectrogram` |
| Multi-file comparison (pairwise, band energy) | ✅ Done | `POST /api/analysis/compare` |
| Sound quality comparison deltas (loudness/sharpness/roughness A/B) | ✅ Done | Woven into `POST /api/analysis/compare`; `soundQuality` per file + `soundQualityDelta` in pairwiseDiffs |
| Event detection (clipping, silence, transients, loudest region) | ✅ Done | `POST /api/analysis/find` |
| Waveform downsampling | ✅ Done | `GET /api/waveform?fileId={id}&points={n}` |
| Playback state machine | ✅ Done | `POST /api/audio/playback/control` |
| Audio file streaming | ✅ Done | `GET /api/audio/file/{fileId}` |
| Agent analysis run (DSP summary for LLM) | ✅ Done | `POST /api/analysis/run` |
| OpenAI API chat proxy | ✅ Done | `POST /api/agent/chat` |
| Agent orchestration (planner → tools → evidence → answer) | ✅ Done | `POST /api/agent/ask` |
| Findings engine (clipping, silence, crest factor, DC offset, tonal peaks) | ✅ Done | `POST /api/analysis/findings` |
| Tonal peak detection (local prominence heuristic) | ✅ Done | Included in spectrum and findings |
| CPB / octave band analysis | ✅ Done | `POST /api/analysis/cpb` |
| Sound quality metrics (loudness, sharpness, roughness) | ✅ First slice done | `POST /api/analysis/sound-quality` |
| Agent orchestration — `run_findings` tool | ✅ Done | Findings pipeline wired into `AgentToolRegistry` + `ToolExecutionService` |
| Agent orchestration — `ToolResultsData` in response | ✅ Done | All 7 tool outputs forwarded to frontend as structured data |
| Agent orchestration — evidence contract | ✅ Done | `AgentAskResult` returns `EvidenceReferences` + `EvidenceItems` so frontend citations can point to measured backend evidence |
| Agent orchestration — investigation trace | ✅ Done | `InvestigationTrace` record + in-memory store exposed in `AgentAskResult` for reproducibility |
| Batch benchmarking | ✅ Done | `POST /api/analysis/batch-benchmark` |
| Python sidecar | ✅ Active | `mosqito==1.2.1`, `PyOctaveBand==1.2.2` installed; executable path in `appsettings.Development.json` |

### Backend Analysis Details

**Level Analyzer:**
- Per-channel: min, max, peak, RMS, DC offset
- dB conversions with configurable reference
- Crest factor calculation
- Multi-channel averaging

**Spectrum Analyzer:**
- FFT size: configurable (default 44100)
- Window: Hann
- Overlap: 50%
- Scaling: one-sided amplitude, coherent-gain corrected
- Averaging: power-based
- Output: columnar arrays (FrequenciesHz[], Magnitudes[], MagnitudesDb[])

**Spectrogram Analyzer:**
- Adaptive frame capping (max 1000 frames)
- Frequency scales: linear, mel, log
- FFT: default 44100, overlap 75%
- Gain range: −10 to +30 dB, dynamic range: 20–120 dB
- Output: byte-normalized (0–255) frames, base64 encoded

**Comparison Engine:**
- Multi-file pairwise analysis
- Pre-computed deltas: peak, RMS, crest factor, frequency differences
- Named frequency bands: sub (20–80 Hz), low, low_mid, mid, presence, high, air (10–20 kHz)
- Band energy deltas computed server-side
- **Psychoacoustic comparison**: `CompareSoundQuality` (loudness/sharpness/roughness) per file + `CompareSoundQualityDelta` (B−A + winner fields) in pairwiseDiffs; when unavailable, compare returns explicit `soundQualityUnavailableReason` at file and pairwise levels for graceful degradation
- **Agent evidence**: `EvidencePackageBuilder` emits `sound_quality_comparison` evidence item when ≥2 files have SQ metrics; agent can cite per-metric deltas as benchmark evidence

**Event Detection:**
- Clipping: ≥0.99 FS, ≥2 consecutive samples
- Silence: ≤−40 dBFS, ≥100 ms (EBU QC 0078B)
- Loudest region: 500 ms window with max RMS
- Transient: fast-onset detection
- Returns AudioEvent[] with start/end times, description, metadata

**Findings Engine:**
- Orchestrates level analysis + all 4 event kinds per file
- Generates structured Finding records: type, severity, confidence, evidence, time/freq location, suggestedNextStep
- Current finding types: `clipping`, `silence_gap`, `high_crest_factor`, `dc_offset`, `tonal_peak`
- Severity: `low` | `medium` | `high`; Confidence: `observed` | `inferred`
- Finding IDs are sequential short keys (`finding_001`, `finding_002`) — no path leakage
- Pure static logic in `FindingsEngine.cs` — no dependencies, deterministic

### Signal Domain Model

```csharp
SignalChannel {
    Id, Name, SampleRate, SampleCount,
    Quantity ("digital_amplitude"), Unit ("FS"),
    DbReference (value, unit, dBUnit),
    CalibrationInfo (isCalibrated, scale, offset),
    Samples (float[])
}
```

## Frontend — Implemented Features

| Feature | Status | Notes |
|---------|--------|-------|
| Drag-and-drop file upload | ✅ Done | WAV, MP3, FLAC, AIFF, OGG; 100 MB max |
| File list with metadata | ✅ Done | Duration, sample rate, channels, bit depth |
| Waveform display (wavesurfer.js) | ✅ Done | Custom WebGL/Canvas, region selection, markers |
| Playback controls (transport) | ✅ Done | Play/pause, seek slider, time display |
| Region selection on waveform | ✅ Done | Click-drag, loop toggle |
| Level analysis inspector | ✅ Done | Multi-channel metrics grid with bars |
| Spectrum panel | ✅ Done | FFT viz, tonal peak summary, channel selection, user params |
| Spectrogram panel | ✅ Done | Time-frequency heatmap |
| Comparison view | ✅ Done | Overlaid spectrum + metrics table + band deltas + **Psych Δ tab** (loudness/sharpness/roughness) |
| Agent chat panel | ✅ Done | Messages, suggestion prompts, compact evidence citation pills; markdown rendering via react-markdown; backend-agent responses use one in-place assistant bubble |
| Agent artifacts panel | ✅ Done | 9 artifact types: analysis, compare, find, findings_result, tool_result, markers, selections, views, reports |
| Agent tool execution loop | ✅ Done | Tool dispatch → API calls → artifact storage |
| Agent orchestrator workspace artifacts | ✅ Done | All 7 orchestrator tools produce deterministic workspace cards; evidence pills focus the matching artifact and keep detail cards expanded |
| Agent orchestrator markdown responses | ✅ Done | Assistant answers rendered as markdown |
| Agent visual response blocks (Generative UI Phase 1) | ✅ Done | Markdown, Statistics, Spectrum chart, Ranking, SuggestedActions blocks rendered inline in chat |
| Agent response activity status | ✅ Done | Live activity label in assistant bubble: planning → running tools → building results → generating answer → complete/failed |
| Agent analysis view blocks (Generative UI Phase 2a) | ✅ Done | `analysisView` block — compact card with mini preview + modal opener; spectrum, CPB, sound quality, findings viewers wired |
| Agent thought container (Generative UI Phase 3) | ✅ Done | Collapsed `<details>` above each assistant answer showing visualization plan decisions — blockType pill + reason per block |
| Agent expert plot specification (Generative UI Phase 4) | ✅ Done | `PlotHints` from DSP evidence zoom spectrum canvas to ±2-octave focus window; dashed annotation line marks dominant peak |
| Agent spectrum overlay (Generative UI Phase 5) | ✅ Done | `SpectrumOverlayBlock` merges 2+ spectrum results into single canvas for direct multi-file comparison |
| Agent investigation card (Generative UI Phase 6) | ✅ Done | `InvestigationBlock` groups mixed DSP types (spectrum + sound quality, etc.) into one diagnostic card with per-signal mini-previews and expand modal |
| Agent findings investigation | ✅ Done | "Detect findings and issues" suggestion chip → run_findings → FindingsCard with per-finding rows |
| Agent referenced context panel | ✅ Done | Workspace shows loaded files, active file/selection, analyses used, limitations, and validation warnings |
| File @mentions in chat | ✅ Done | Autocomplete dropdown |
| Mode switcher (Manual ↔ Agent) | ✅ Done | Segmented control in header |
| Resizable panels | ✅ Done | Drag handles, collapsible |
| Keyboard shortcuts | ✅ Done | Arrow seek, space play/pause |
| Guided investigation prompt | ✅ Done | Post-upload CTA tiles (Findings / Spectrum / Sound quality) + sidebar active-state badges |
| Report generation UI | ✅ Done | AI-generated batch benchmark reports with `useBenchmarkReport` hook — rankings, outliers, findings interpreted by agent and displayed in workspace |
| Task progress panel | 🟡 Placeholder | Empty state only |
| Calibration UI | 🟡 Referenced in types | Not implemented |
| CPB / octave band visualization | ✅ Done | Collapsible CPB panel with octave / 1⁄3 octave modes |
| Sound quality metrics display | ✅ First slice done | Manual panel for MoSQITo stationary loudness + DIN sharpness |
| Batch comparison table | ✅ Done | Ranking, outliers, file rows, side-by-side layout with RankingsCard and OutliersCard visualization |
| Findings panel | ✅ Done | Severity-coded cards, tonal peak findings, evidence chips, suggested next step, time range |
| UI brand name | ✅ Done | Header logo shows **SoundLens** (internal codebase remains AcousticCanvas) |

### Redux Store Structure

| Slice | Purpose |
|-------|---------|
| `navigation` | activeMode, activeFileId, activeView |
| `project` | projectName, files[], selectedSignalId, markers[], visibleViews[] |
| `waveformSelection` | startSeconds, endSeconds, loopEnabled |
| `analysis` | Level analysis result + status |
| `spectrum` | Spectrum result + user parameters |
| `spectrogram` | Spectrogram result + user parameters |
| `chat` | messages[], isThinking, selectedModel, evidenceReferences/evidenceItems/limitations on assistant messages |
| `agentWorkspace` | artifacts[], focusedArtifactId, expandedArtifactIds |
| `findings` | FindingsResult, status, error |

### Agent Tool System

The agent has two parallel execution paths:

**Old frontend tool loop** (workspace mutations — markers, selections, views, reports):

| Tool | Purpose |
|------|---------|
| `getState` | Query current workspace state |
| `analyze` | Run analysis (file_info, level, spectrum + semantic kinds) |
| `compare` | Compare two files/regions |
| `find` | Detect events (clipping, silence, clicks) |
| `workspace` | Manipulate workspace (markers, selections, views) |
| `report` | Generate markdown reports |

**Backend orchestrator** (`POST /api/agent/ask` — investigative questions):

| Tool | Purpose | Artifact type |
|------|---------|---------------|
| `get_metadata` | File duration, sample rate, channels, bit depth | `tool_result` |
| `run_basic_metrics` | Peak, RMS, crest factor | `tool_result` |
| `run_event_detection` | Clipping/silence/transient events | `tool_result` |
| `run_spectrum` | FFT peak frequency + dominant peaks | `tool_result` |
| `run_spectrogram` | Full-file spectrogram time-frequency summary | `tool_result` |
| `run_cpb` | Octave/1⁄3-octave band levels | `tool_result` |
| `run_sound_quality_metrics` | Loudness, sharpness, roughness | `tool_result` |
| `run_findings` | Full findings pipeline (clipping, silence, crest, DC offset, tonal peaks) | `findings_result` |

Routing: `questionRouter.ts` dispatches investigative keywords → orchestrator; workspace action keywords → old tool loop.

All orchestrator tool outputs are forwarded to the frontend via `ToolResultsData` in `AgentAskResult`. The backend also returns `EvidenceReferences` and `EvidenceItems`, so chat citations can reference backend evidence separately from workspace artifact IDs. The frontend (`useAgentAsk`) creates workspace artifacts for every completed tool, stores evidence metadata on assistant messages, and renders compact evidence pills in chat. Clicking an evidence pill focuses the matching workspace artifact by evidence type and file ID; detail cards remain expanded after the temporary focus highlight clears.

Agent file targeting: explicit `@fileName` mentions in chat narrow `selectedFileIds` to the mentioned file(s). If no file is mentioned, the Agent falls back to all loaded files for multi-file analysis.

Agent behavior questions: meta-questions such as "why did you analyze both?" are answered directly without running DSP tools.

Agent method questions: definitions or conceptual questions such as "what is a spectrogram?", "what does CPB mean?", or "how is roughness measured?" should be answered with `no_analysis_needed` unless the user explicitly asks to analyze loaded audio. Data questions such as "what does the spectrogram show for @file.wav?" should still run the relevant deterministic tool. Measurement questions such as "what is the SPL in the spectrogram?" must not be treated as definitions; current spectrogram artifacts are relative/byte-normalized and cannot report SPL without calibration. No-tool answers must clear/remove any planning bubble and must not show malformed generic next steps.

Agent UI-instruction handling: typed test instructions such as "Click Spectrogram evidence pill" or "Inspect workspace card" are UI actions, not audio-analysis requests. The Agent should answer with UI guidance and should not run DSP tools.

Agent file loading check: if no files are loaded and the user asks an audio-related question (detected via keywords like "sound", "audio", "file", "waveform", "spectrogram", "spectrum", "frequency", "peak", "RMS", "analyze", etc.), the Agent responds with a no-tool answer asking the user to upload and select an audio file first. This prevents the Agent from attempting analysis without context.

Agent spectrogram artifacts: multi-file `run_spectrogram` results create one workspace artifact per file, so each spectrogram evidence pill focuses the matching file-specific artifact instead of a combined card.

Agent spectrum artifacts: multi-file `run_spectrum` results create one workspace artifact per file, so each Spectrum evidence pill focuses the matching file-specific artifact instead of a combined card.

Agent CPB artifacts: multi-file `run_cpb` results create one workspace artifact per file, so each CPB evidence pill focuses the matching file-specific artifact instead of a combined card.

Agent Sound Quality artifacts: multi-file `run_sound_quality_metrics` results create one workspace artifact per file, so each Sound quality evidence pill focuses the matching file-specific artifact instead of a combined card.

Agent spectrogram answer contract: compact spectrogram evidence supports duration, displayed range, Nyquist/frequency coverage, FFT size, scale, frame count, and bin count. It does not expose per-frame energy coordinates, bright-line positions, dominant bands over time, complexity, harmonic richness, or transient timestamps to the final-answer model. Duration/frame count describe time coverage/resolution only; they must not be used to infer broader frequency range or richer/less complex content. For burst/transient questions, the planner should pair `run_spectrogram` with `run_event_detection(kind="transient")`; for explicitly spectrogram-only comparisons, it should not add FFT spectrum unless peaks/tonal balance are also requested. For "what causes this band?" the cause remains unknown unless supported by matching spectrum/reference/order evidence. For "energy near X Hz throughout" the Agent must not use overall FFT spectrum alone as proof of time persistence.

Spectrogram axis wording: avoid legacy SPL colorbar wording. Pressure-calibrated spectrograms use `Level [dB re 20 µPa]`; uncalibrated digital spectrograms use `Amplitude [dBFS]`. The spectrogram time axis shows tick labels only; do not render a separate `Time (s)` footer title.

Agent spectrum answer contract: spectrum evidence supports full-file/region averaged FFT peak frequency, max magnitude, dominant peaks, and comparison deltas. It must not be used as time-continuity evidence, SPL evidence without calibration, LUFS evidence, compliance evidence, or proof of a physical source/cause. Definition questions such as "what is an FFT spectrum?" should be answered without tools; measurement questions such as "what is the peak frequency?" should run `run_spectrum`.

Agent CPB answer contract: CPB evidence supports octave/third-octave band balance, highest-band summaries, and broad boomy/muddy/bright/dull descriptions. It must not be used as exact tonal-peak evidence, SPL evidence without calibration, or standards-compliance evidence. Current default CPB method is `fft_bin_power_sum` and must be described as a nominal approximation, not IEC 61260 compliant, unless a validated filter-bank method is explicitly used.

Agent Sound Quality answer contract: sound-quality evidence supports MoSQITo loudness (`sone`), sharpness (`acum`), and roughness (`asper`) for relative perceived-quality comparisons. It must not be converted to LUFS, SPL, gain change, standards compliance, or physical root cause. Harshness explanations should use sharpness/roughness as primary psychoacoustic evidence, optionally supported by CPB/spectrum evidence. Definition questions such as "what is roughness?" should be answered without tools; measurement questions such as "what is the roughness of @file.wav?", "what is the loudness?", or "what is the loudness and roughness?" should run `run_sound_quality_metrics`.

Agent behavior evals: `AcousticCanvas.Tests/AgentBehavior/agent_eval_cases.jsonl` plus `AgentBehaviorEvalTests` define deterministic, no-tool, planner-prompt, and final-answer grounding contracts for spectrum, spectrogram, CPB, Sound Quality, clipping, comparison, UI-action, and unsupported-conversion scenarios. These are local workflow/contract tests, not live LLM answer-quality evals; a production `AgentRunTrace` and model-graded eval loop remain future work.

Semantic analysis kinds available (old loop): loudness, peaks, dynamics, spectral_balance, noise, stereo_phase, distortion, dialogue_clarity.

### API Base URL

`http://localhost:5146`

---

# 3. Strategic Positioning

The product should not compete only as a plotting tool.

Existing tools already provide strong plotting and analysis features:

- HEAD acoustics ArtemiS SUITE
- HBK / BK Connect
- Siemens Simcenter Testlab
- Listen Inc SoundCheck
- MATLAB / Python workflows
- REW / Audacity for simpler analysis
- Internal company scripts and tools

AcousticGPT should differentiate through:

1. AI-assisted investigation
2. Evidence-based findings
3. Batch product comparison
4. Sound quality interpretation
5. Benchmarking workflows
6. Human-readable explanations
7. Suggested next analyses
8. Reproducible reports
9. Project memory
10. Ability to compare many products/signals/settings
11. **AI-generated visual analysis / Generative UI** — Agent dynamically generates plots, charts, rankings, and investigation dashboards instead of text-only replies

The strongest product direction is:

> **AI benchmark intelligence and acoustic investigation for product sound teams.**

The strongest differentiator is that AcousticGPT is not a chatbot bolted onto an audio analysis tool. It is an AI acoustic engineering assistant that can decide what evidence is needed, run the right DSP tools, create the right visual evidence, configure plots like an expert, compare and rank signals, explain the result in engineering language, and suggest what to do next.

---

# 4. Target Users

Primary target users:

- Sound quality engineers
- Acoustic engineers
- NVH engineers
- Audio engineers
- Product sound teams
- R&D engineers
- Test engineers
- Consumer product engineers
- Hearing-aid/audio-device engineers
- White-goods sound-quality teams
- Consultants working with sound and vibration

Do not target "everyone who uses audio" at the beginning.

Avoid building a generic audio editor.

The first strong use cases should be professional sound analysis and comparison.

---

# 5. Example High-Value Use Cases

## Use Case 1 — Product Sound Comparison

A user imports recordings from several product versions.

The app should answer:

- Which product is louder?
- Which product is sharper?
- Which one has tonal peaks?
- Which one has more impulsive events?
- Which product sounds more annoying?
- What evidence supports that conclusion?

## Use Case 2 — Hearing-Aid Product Benchmarking

A user from a hearing-aid company wants to compare 100 products, settings, or firmware versions.

The app should support:

```
100 products/settings
→ same input test signals
→ output recordings
→ batch metrics
→ ranking
→ clustering
→ outlier detection
→ AI explanation
→ report
```

Possible metrics:

- Loudness
- Sharpness
- Roughness
- Fluctuation strength
- Spectrum
- Spectrogram
- CPB / 1⁄3 octave
- Clipping
- Crest factor
- Tonal peaks
- Latency if input/output alignment is available
- Artifact indicators
- Similarity to benchmark/reference

The agent should explain trade-offs, for example:

> "Product 42 performs well in speech-like frequency regions but shows stronger high-frequency energy around 4–6 kHz, which may be perceived as sharper or harsher than the reference."

The agent must only say this if the backend has provided supporting evidence.

## Use Case 3 — Acoustic Investigation

The user asks:

> "Why does this recording sound annoying?"

The app should not simply show a plot.

It should investigate:

- Is there clipping?
- Is there a tonal peak?
- Is there a broadband noise increase?
- Are there transient impacts?
- Is sharpness high?
- Is there modulation?
- Is one product worse than the benchmark?
- What analysis should be run next?

## Use Case 4 — Report Generation

The user runs analysis and asks the agent to generate:

- Short engineering summary
- Product comparison report
- Issue list
- Suggested next tests
- Customer-friendly explanation
- Internal R&D report

Reports must be grounded in measured data.

---

# 6. Core Product Principles

## Principle 1 — Evidence Before Explanation

The backend computes facts.
The AI explains facts.
Never let the OpenAI API invent conclusions directly from raw audio.

The LLM may decide what analysis is needed, which trusted response blocks should be shown, what data should be compared, how axes/scales/units should be configured, and how to explain the result. It must not fabricate SPL, dBFS, RMS, peak, FFT peak, frequency, loudness, sharpness, roughness, tonality, source contribution, ranking, statistic, or chart data values. All numbers must come from deterministic backend tools.

The correct architecture is:

```
Audio file
→ deterministic DSP / analysis modules
→ structured evidence JSON
→ findings engine
→ OpenAI API
→ explanation / report / suggestions
```

The AI should receive structured information like:

```json
{
  "fileId": "product_b.wav",
  "metadata": {
    "durationSeconds": 12.4,
    "sampleRateHz": 48000,
    "channels": 1
  },
  "basicMetrics": {
    "rmsDbFs": -18.4,
    "peakDbFs": -1.2,
    "crestFactorDb": 14.5,
    "clippingDetected": false
  },
  "spectralFindings": [
    {
      "type": "tonal_peak",
      "frequencyHz": 685,
      "prominenceDb": 11.2,
      "confidence": 0.91
    }
  ]
}
```

Then the agent can say:

> "There is a strong tonal peak around 685 Hz, with 11.2 dB prominence over nearby frequencies. This may explain a perceived whine. A useful next step is to compare this peak against RPM/order data or against a reference recording."

## Principle 2 — Controlled Autonomy for Acoustic Investigation

The agent should not scale by accumulating endless hardcoded rules like "if the user asks X, run tool Y."

The target product behavior is a constrained acoustic investigation system:

```
User question
→ AgentIntentClassifier
→ evidence requirements
→ AgentPlanner
→ ToolPolicyValidator
→ ToolExecutionService
→ EvidencePackageBuilder
→ Findings / HypothesisRanker
→ ActionRecommender
→ AgentResponseValidator
→ grounded answer / report + workspace artifacts + investigation timeline
```

The backend remains responsible for deterministic measurements. The AI may classify intent, plan approved tools, explain evidence, rank hypotheses, and suggest safe next actions, but it must not invent measurements or present unsupported interpretations as facts.

### Agent Intent Layer

Agent requests should first be classified into a small set of explicit acoustic intents:

- `general_diagnosis`
- `compare_files`
- `rank_candidates`
- `explain_perception`
- `detect_specific_issue`
- `suggest_modification`
- `generate_report`
- `ask_method_question`
- `search_external_context`

Intent classification should drive evidence requirements. For example, "why does this sound harsh?" may require sound-quality metrics, spectrum, CPB, and findings; "why did you analyze both?" should be treated as an agent behavior question and should not run DSP tools.

### Evidence Layer

Evidence types should be explicit and reusable across chat, workspace artifacts, findings, reports, and benchmarks:

- `metadata`
- `basic_metrics`
- `spectrum`
- `spectrogram`
- `cpb`
- `sound_quality_metrics`
- `event_detection`
- `findings`
- `reference_comparison`
- `similarity`
- `external_context`

Every evidence item should include file identity, region, parameters, method, limitations, and measured values where applicable. Evidence should remain separate from the final narrative so reports can be reproduced and audited.

### Tool Layer

Tools are approved deterministic capabilities, not arbitrary AI actions. The planner should select tools by required evidence type, and a policy validator should reject unknown, unsafe, or irrelevant tools before execution.

Current and planned tool mapping:

| Evidence needed | Approved tool |
|-----------------|---------------|
| `metadata` | `get_metadata` |
| `basic_metrics` | `run_basic_metrics` |
| `spectrum` | `run_spectrum` |
| `spectrogram` | `run_spectrogram` |
| `cpb` | `run_cpb` |
| `sound_quality_metrics` | `run_sound_quality_metrics` |
| `event_detection` | `run_event_detection` |
| `findings` | `run_findings` |
| `reference_comparison` | `compare_files` |
| `similarity` | Future `run_similarity` |
| `external_context` | Future `search_case_library` / `search_external_context` |

### Safe Action Layer

Agent autonomy must be bounded by action safety:

| Level | Action type | Policy |
|-------|-------------|--------|
| 1 | Read-only analysis tools | Safe to run automatically |
| 2 | View/navigation actions visible to the user | Safe when reversible and visible |
| 3 | Non-destructive preview actions | Allowed only as temporary previews |
| 4 | Destructive, external, or project-changing actions | Require explicit user confirmation |

Examples of Level 4 actions include deleting files, overwriting reports, exporting externally, uploading audio to a third-party service, changing project calibration, or applying permanent processing.

### Hypothesis Layer

The agent should rank possible explanations from evidence instead of jumping to a single confident answer. Responses should distinguish:

- Measured facts
- Inferred hypotheses
- Unsupported explanations
- Limitations
- Suggested next tests

Example: a tonal peak near 1 kHz is a measured fact; "likely perceived as a whine" is an inferred hypothesis; "caused by motor order X" is unsupported unless RPM/order data or reference context exists.

### External Knowledge Policy

External context is allowed only with strict boundaries:

- Internet or standards context is not measured evidence from the user's audio.
- Use external sources for standards, specifications, definitions, and background, not for invented objective benchmark claims.
- Prefer local curated case libraries and validated references before open internet search.
- Do not upload user audio externally without explicit confirmation.
- If external context is used, cite it separately from measured audio evidence and state its limitations.

### Autonomy Modes

The product should support explicit autonomy modes:

- **Explain only** — answer from already available evidence; do not run new tools.
- **Assistive autonomy** — preferred default; run safe read-only analysis tools and explain what was used.
- **Proactive investigation** — run a broader approved investigation suite and propose next tests.
- **Strict approval** — ask before every tool/action.

The default should be assistive autonomy: the agent can run Level 1 read-only analysis, produce evidence-backed hypotheses, and suggest next actions, while leaving destructive/project-changing work to explicit confirmation.

Current implementation already has important pieces of this architecture: `AgentPlanner`, `AgentToolRegistry`, `ToolExecutionService`, `EvidencePackageBuilder`, and `AgentResponseValidator`. Future agent work should make the intent classifier, tool policy validator, hypothesis ranker, action recommender, and investigation timeline explicit rather than adding isolated prompt rules.

## Principle 3 — Findings, Not Only Chat

The app should have a structured **Findings Panel**.

Examples of findings:

- Clipping detected
- Tonal peak detected
- High sharpness
- Loudness difference
- Broadband noise increase
- Transient impact
- Outlier recording
- Similar to reference
- Different from benchmark
- Suspicious high-frequency energy
- Possible modulation
- Possible artifact

Each finding should include:

- Finding type
- Severity
- Confidence
- Evidence
- Time location, if relevant
- Frequency location, if relevant
- Suggested next step
- Related plot or analysis

## Principle 4 — Reproducibility

Every result must be reproducible.

For every AI conclusion, store:

- Input file
- Analysis module used
- Parameters used
- Computed metrics
- Finding ID
- Agent prompt/context
- Agent answer
- Evidence used

No hidden calculations. No fabricated values. No placeholder values presented as real analysis.

## Principle 5 — Batch Comparison Is a Key Differentiator

A major differentiator is the ability to compare many sounds at once.

The product should support:

- 10 files → 50 files → 100 files
- Product families
- Firmware versions
- Settings
- Reference vs candidate products
- Before/after comparison
- Ranking, clustering, outlier detection
- Report generation

This is more commercially interesting than single-file analysis.

## Principle 6 — Keep the Product Narrow at First

Do not build: a DAW, a generic audio editor, a music-production tool, a generic chatbot, a MATLAB clone, a full replacement for enterprise NVH platforms.

Start with:

> Professional sound analysis, comparison, and AI-assisted interpretation.

---

# 7. Technical Architecture

## Frontend

React + Mantine + Redux Toolkit + wavesurfer.js

Frontend responsibilities:

- Display data
- Let user choose analysis
- Show loading/error/empty states
- Show analysis parameters
- Show evidence used by agent
- Send user requests to backend
- Never fabricate metrics
- Never perform critical heavy DSP

### Key UI Surfaces

| Surface | Description |
|---------|-------------|
| Manual Workspace | File list + waveform + resizable analysis panels |
| Agent Workspace | Chat panel + artifacts panel |
| Spectrum Panel | FFT visualization with user parameters |
| Spectrogram Panel | Time-frequency heatmap |
| Comparison View | Overlaid spectra + metrics table + band energy |
| Analysis Inspector | Multi-channel level metrics grid |
| Transport Controls | Play/pause/seek/loop |

## Engineering Visualization Standards

AcousticGPT/SoundLens visualizations must be engineering-grade, not merely decorative.
Every plot must make it clear what data is shown, what units are used, how it was computed,
and how it supports the acoustic investigation.

## Agent Visual Planning Architecture

Agent-generated visual analysis must use constrained Generative UI: the Agent returns typed response blocks and visualization specifications, not arbitrary UI code. The frontend owns rendering, and the backend owns the numerical truth.

### Expert Visualization Planner

The Expert Visualization Planner decides the best response format for each user request. Internally it should decide:

1. Whether visualization is needed at all.
2. Which visualization type is most appropriate.
3. Which files, channels, time regions, signals, or metrics should be included.
4. Whether multiple signals should be overlaid, separated, or shown as coordinated views.
5. What the x-axis and y-axis represent, including units and scale.
6. What range or zoom should be displayed, including focused ranges such as `800-1200 Hz` for a 1 kHz issue.
7. Whether to show markers, peak labels, cursors, annotations, thresholds, reference lines, highlighted regions, legends, or metadata.
8. Whether raw, averaged, smoothed, filtered, octave-band, one-third-octave, or derived-metric data is required.
9. What engineering metadata is required for trust.
10. What minimal visual evidence answers the question clearly.

The Agent should not always create plots. Some questions need only text; some need statistics; some need one plot; some need multiple coordinated plots; some need rankings, tables, or report-style investigation cards.

### PlotSpecificationPlanner

The PlotSpecificationPlanner converts the user question and available deterministic analysis results into precise visualization specifications. A specification should include:

- Plot type.
- Data sources and result references.
- Selected files, channels, and time regions.
- Selected frequency range or metric set.
- Axis labels, units, scale, and min/max.
- Overlay strategy and legend labels.
- Annotations, peak markers, harmonic markers, thresholds, highlighted regions, and selected regions.
- Metadata display requirements.
- Default zoom/range.
- Fixed vs automatic scaling.
- Reason for the visualization choice.
- Confidence and limitations.

Example target shape:

```json
{
  "type": "spectrumOverlay",
  "title": "Spectrum comparison, File A vs File B",
  "dataSources": [
    { "resultRef": "spectrum_file_a_001", "label": "File A", "channel": "Mono", "timeRangeSeconds": [0, 5] },
    { "resultRef": "spectrum_file_b_001", "label": "File B", "channel": "Mono", "timeRangeSeconds": [0, 5] }
  ],
  "xAxis": { "label": "Frequency", "unit": "Hz", "scale": "linear", "min": 20, "max": 10000 },
  "yAxis": { "label": "Level", "unit": "dB SPL", "scale": "dB", "autoScale": true },
  "displayOptions": {
    "showLegend": true,
    "showGrid": true,
    "showPeakMarkers": true,
    "showDominantFrequencyLabels": true,
    "showMetadata": true
  }
}
```

### Agent Response Block Model

Agent responses should be lists of typed blocks, not only a text string. Supported and planned block types include:

- `MarkdownBlock`
- `StatisticsBlock`
- `SpectrumChartBlock`
- `SpectrumOverlayBlock`
- `SpectrogramChartBlock`
- `WaveformChartBlock`
- `TimeSeriesMetricBlock`
- `RankingBlock`
- `MetricComparisonBlock`
- `PeakTableBlock`
- `ContributionChartBlock`
- `AudioPlayerBlock`
- `SuggestedActionsBlock`
- `InvestigationCardBlock`
- `ReportSummaryBlock`

The Agent chooses the block structure. Backend DSP tools provide `resultId`/`dataRef` values and measured data. The frontend renders each block with trusted acoustic components.

### Visualization Decision Rules

- If the user asks generically for "a plot", "graph this", or "show me a chart" without naming the plot type, the Agent should infer the most useful visual from the investigation intent and explain the reason for that choice in one short sentence. If multiple plot types are plausible, it should either choose the safest default and mention the alternative, or show complementary blocks when both add distinct evidence. It should not ask a clarification question unless choosing the plot would materially change the analysis or risk misleading the user.
- Use **text only** for definitions, concepts, implementation guidance, or cases where no file/data/result is involved and a visual would not add evidence.
- Use **statistics blocks** for level, RMS, peak, crest factor, duration, clipping, metadata, or compact signal-property summaries.
- Use **spectrum plots** for frequency content, tones, peaks, harmonics, resonances, tonal noise, broadband noise, or spectral differences.
- Use **spectrum overlays** when comparing files, channels, regions, before/after processing, or measured vs predicted data that share the same x-axis and y-axis units.
- Use **spectrograms** when the user asks how sound changes over time, about transient events, tonal drift, intermittent tones, or anything an averaged spectrum would hide.
- Use **waveform plots** for clipping, transients, edits/cuts, region selection, or when time-domain shape matters.
- Use **metric-over-time plots** for temporal variation in loudness, sharpness, roughness, level, tonality, or annoyance-related metrics.
- Use **bar charts** for rankings, dominant contributors, top frequencies, source contributions, and metric comparisons.
- Use **tables** when exact values, multi-metric traceability, or engineering auditability matter.
- Use **investigation cards** for broad diagnostic questions like "Why does this sound annoying?", "What is wrong with this sound?", "Which file is worse?", "Which source contributes most?", or "What should I look at?"

### Plot Combination Rules

- Overlay signals in the same plot when they share the same x-axis and y-axis units, the number of series is readable, and overlaying makes comparison easier.
- Use separate plots when units differ, scales are too different, one signal would hide another, one view is time-domain and another is frequency-domain, or there are too many series to read clearly.
- Use shared axes for comparable files/channels/regions, before/after processing, and measured-vs-predicted comparisons.
- Use fixed scales for side-by-side comparisons, spectrogram comparisons, before/after views, and any situation where visual fairness matters.
- Use auto-scale for a single signal when the goal is detail inspection and comparison fairness is not the main objective.

### Axis and Scale Rules

- Spectra: x-axis `Frequency [Hz]`; y-axis `Level [dB SPL]` or `Level [dBFS]` depending on calibration; include FFT size, window, overlap, averaging, scaling, and calibration.
- Spectrograms: x-axis `Time [s]`; y-axis `Frequency [Hz]`; color scale `Level [dB SPL]` or `Amplitude [dBFS]`; use fixed color scale when comparing spectrograms.
- Waveforms: x-axis `Time [s]`; y-axis calibrated pressure, normalized amplitude, or dBFS depending on available calibration.
- Metric-over-time: x-axis `Time [s]`; y-axis metric value with unit, such as `Loudness [sone]`, `Sharpness [acum]`, `Roughness [asper]`, or `Level [dB SPL]`.
- Rankings: rows or x-axis show file/source/channel names; metric score is clearly labeled; sort descending unless lower is better.
- Source contribution plots: show whether values are absolute, relative, dB, percentage, or contribution level.

### 1. Axis labels and units are required

- Every graph labels both axes unless one axis is truly not applicable to the visual form.
- Axis labels must include quantity + unit.
- Preferred examples: `Time (s)`, `Frequency (Hz)`, `Level (dBFS)`, `Level (dB SPL)` when calibrated,
  `Magnitude (dB)`, `Amplitude (FS)`, `Loudness (sone)`, `Sharpness (acum)`, `Roughness (asper)`,
  `Band center frequency (Hz)`.
- Avoid vague labels like `Value`, `Data`, `Y`, or `Magnitude` without unit context.

### 2. Legends are required for multi-series data

- Any graph with more than one file, channel, metric, or overlay must provide a visible legend.
- Do not rely on color alone to identify traces.
- Legend labels should be human-readable and investigation-specific (for example: `Reference - left channel`,
  `Candidate B - averaged channels`, `Original`, `Notch preview`).

### 3. Color mapping must be consistent and meaningful

- File, channel, and role colors should stay stable across panels when possible.
- Reference/candidate colors should remain stable across comparison surfaces.
- Findings severities and status colors must use a documented, consistent meaning.
- Colors must not be re-randomized on each refresh or rerun.

### 4. Axis scaling must be fair and non-misleading

- Default scaling must support interpretation, not visual exaggeration.
- Comparison views should use shared axes by default.
- Do not auto-scale each compared signal independently in ways that hide differences.
- Spectrum should support suitable frequency scaling modes (linear/log) where appropriate.
- CPB x-axis must clearly represent octave or one-third-octave centers.
- Spectrogram color scale ranges should be stable enough for side-by-side comparison.
- Rule: when comparing signals, use consistent scales unless the UI explicitly states otherwise.
- If auto-scale is active, expose this state clearly and keep room for future lock/reset scale controls.

### 5. Calibration and unit trust state must be explicit

- Graphs must state whether values are FS amplitude, dBFS, calibrated dB SPL, or relative-only metrics.
- Uncalibrated files must carry explicit caveats, for example:
  `Uncalibrated WAV: levels are relative dBFS, not absolute dB SPL.`
- Sound-quality metrics on uncalibrated signals must be presented as relative-comparison values,
  not physical acoustic truth.

### 6. Analysis parameters must be accessible

- Each analysis visualization must expose, or link to, the parameters used to generate it.
- Parameter examples: FFT size, window, overlap, averaging, frequency scale, dynamic range,
  weighting (A/C/Z), CPB method, sound-quality method, selected region, selected channel,
  sample rate, calibration state.
- Parameters can live in compact UI elements (subtitle, tooltip, details panel, metadata card)
  but must remain inspectable.

### 7. Spectrogram/heatmap color scales are mandatory

- Spectrograms and heatmaps must include a visible color scale or equivalent legend.
- The color scale must describe what color encodes, with unit or relative-scale meaning,
  and min/max (or dynamic range) context.
- Avoid heatmaps where color meaning is ambiguous.

### 8. Comparison plots must optimize fair comparison

- Comparison surfaces must clearly show file names, units, legends, and deltas where relevant.
- Highlight largest differences when it improves interpretation.
- Avoid independent auto-scaling unless explicitly labeled.
- CPB comparison should show band center frequency, per-file level, delta, weighting, and method.
- Sound-quality comparison should show per-file value, delta, interpretation (higher/lower/winner when meaningful),
  method, and known limitations.

### 9. Engineering inspectability is a product requirement

- Visualizations should support engineering investigation workflows such as:
  hover tooltips with exact values, zoom/pan where applicable, reset zoom, region selection,
  frequency-band focus, finding highlight, and future data/image export paths.
- Not all controls are required immediately, but this capability is part of the roadmap quality bar.

### 10. Empty/loading/error states must be explicit

- Visualization panels must not fail silently.
- Required states include: no file selected, analysis not run, unsupported file, tool failure,
  Python sidecar unavailable, insufficient data, region too short, and calibration missing.
- Each state should communicate what happened and what the user can do next.

### 11. Titles/subtitles must carry investigation context

- Titles should answer: what is shown, for which file(s), and for which region/channel.
- Good examples:
  `Spectrum - Product B, left channel`
  `One-third-octave CPB comparison - Reference vs Candidate`
  `Spectrogram - selected 2.0 to 4.5 s region`
  `Sound-quality metrics - full file, uncalibrated`
- Avoid generic titles like `Chart`, `Analysis`, `Result`, `Graph`.

### 12. Accessibility and readability requirements

- Plots must remain readable in normal engineering use: adequate font size, sufficient contrast,
  readable tick labels, sensible density, and no reliance on color alone.
- Avoid overplotting and excessive grid clutter.
- For many-series views, support progressive disclosure approaches (legend filtering, focus/solo view,
  summary table + selected plot).

### 13. Evidence-linked visualization requirement

- Plots are evidence surfaces, not decoration.
- Agent claims that depend on a plot must be traceable to file, channel, region, metric,
  parameters, and the corresponding visualization surface.
- Example requirement: if the agent cites a tonal peak around 685 Hz, the UI should allow users
  to open the related spectrum evidence with frequency marker and relevant analysis metadata.

### 14. Future reusable chart metadata contract

- Future chart components should converge on a shared metadata contract to enforce consistency.
- Suggested target contract for future implementation (not required to implement in this slice):

```ts
type ChartMetadata = {
  title: string;
  subtitle?: string;
  xLabel: string;
  yLabel: string;
  xUnit?: string;
  yUnit?: string;
  series: ChartSeriesMetadata[];
  analysisParameters?: Record<string, unknown>;
  calibrationState?: 'uncalibrated' | 'calibrated' | 'unknown';
  scalingMode?: 'auto' | 'shared' | 'locked' | 'manual';
  warnings?: string[];
};

type ChartSeriesMetadata = {
  id: string;
  label: string;
  fileId?: string;
  channelId?: string;
  regionId?: string;
  colorKey?: string;
  unit?: string;
};
```

This contract is a roadmap requirement for future chart abstractions and should be applied
incrementally without rewriting existing plotting surfaces in one large change.

## Backend

.NET 8 + FastEndpoints + MathNet.Numerics + NAudio

Backend responsibilities:

- Audio file orchestration
- Project state
- File metadata extraction
- Audio loading/decoding
- DSP pipeline (level, spectrum, spectrogram, comparison, events)
- Finding generation
- OpenAI API orchestration (infrastructure ready)
- Python sidecar orchestration for CPB and sound-quality metrics
- Result caching (future)
- Export/report data (future)

### File Storage

Local filesystem: `AudioStorage/` directory with 12-character GUID filenames.

### Playback

In-memory `ConcurrentDictionary` for playback state. Commands: play, pause, seek, stop.

## Python Sidecar (Active)

Installed packages (system Python 3.13 at `C:\Users\JCASTRESANA\AppData\Local\Programs\Python\Python313\python.exe`):

- `mosqito==1.2.1` — psychoacoustic metrics (loudness, sharpness, roughness)
- `PyOctaveBand==1.2.2` — fractional octave filter bank
- `scipy`, `numpy 2.4.6`, `numba`, `llvmlite`, `pyuff` — installed as dependencies

Executable path configured in `appsettings.Development.json` under `PythonSidecar:Executable`.

Implemented uses:

- CPB `python_filter_bank` method through a subprocess sidecar
- MoSQITo stationary loudness and DIN sharpness through a subprocess sidecar

Planned uses:

- MoSQITo for additional sound-quality metrics (fluctuation strength)
- Scientific libraries
- Audio embedding models
- ML inference
- Prototype algorithms before porting to C#

Important:

- Do not tightly couple the whole product to Python.
- Treat Python-based analysis as replaceable plugins.
- Define clean contracts between C# and Python.
- Handle Python errors clearly.
- Avoid blocking the UI while Python tasks run.

## MoSQITo / Sound Quality

Strategy:

- Use MoSQITo for first-pass stationary loudness, sharpness, and roughness.
- Keep uncalibrated values explicitly labelled as relative-comparison metrics until calibration metadata maps samples to physical sound pressure.
- Consider native C# implementations only where the standard and validation fixture set are clear.
- Keep the interface generic so another engine can replace it later

Example abstraction:

```csharp
public interface ISoundQualityAnalysisService
{
    Task AnalyzeAsync(
        AudioSignalReference signal,
        SoundQualityAnalysisParameters parameters,
        CancellationToken cancellationToken);
}
```

## OpenAI API Layer

**Current state**: Fully connected. The frontend tool loop dispatches tool calls, collects results, and sends conversation context to `POST /api/agent/chat`. The backend (`OpenAiChatService`) injects the system prompt, forwards to OpenAI (gpt-4o-mini), and returns the response. The API key is stored server-side in `appsettings.Development.json` (gitignored) or in the backend process environment variable `OPENAI_API_KEY`.

Security rule: never put OpenAI keys in frontend `.env` files or any `VITE_*` variable. Vite exposes `VITE_*` values to browser code and debug output.

OpenAI API is used for:

- Explanation
- Interpretation
- Report generation
- Suggested next steps
- Comparing results
- Summarizing findings
- Answering user questions grounded in measured evidence

OpenAI API is not used as the primary source of numeric truth.

---

# 8. Data Flow

```
User imports files
    ↓
Backend extracts metadata (on upload)
    ↓
User selects manual or agent analysis
    ↓
Backend runs deterministic DSP (level, spectrum, spectrogram, compare, find)
    ↓
Backend produces structured analysis result (JSON)
    ↓
Frontend displays plots + metrics + findings
    ↓
User asks agent question (or agent tool loop auto-runs)
    ↓
Backend sends selected evidence to OpenAI API (not yet connected)
    ↓
Agent returns explanation + next steps
    ↓
User can save finding/report as artifact
```

---

# 9. Analysis Modules — Priority & Status

## Basic Analysis ✅ DONE

- ✅ Duration
- ✅ Sample rate
- ✅ Channel count
- ✅ Peak level
- ✅ RMS level
- ✅ Crest factor
- ✅ Clipping detection (≥0.99 FS, ≥2 samples)
- ✅ DC offset
- ✅ Silence detection (≤−40 dBFS, ≥100 ms)

## Spectral Analysis ✅ DONE

- ✅ FFT spectrum (configurable size, window, overlap)
- ✅ Averaged spectrum (power-based averaging)
- ✅ Spectrogram (STFT, multi-scale: linear/mel/log)
- ✅ Peak frequency detection
- ✅ Tonal peak detection (with local prominence/confidence heuristic)
- ❌ Band energy comparison as standalone feature

## Event Detection ✅ DONE

- ✅ Clipping detection
- ✅ Silence detection
- ✅ Loudest region detection
- ✅ Transient detection

## Comparison ✅ DONE

- ✅ Multi-file pairwise comparison
- ✅ Delta in peak/RMS/crest factor
- ✅ Frequency-domain differences
- ✅ Named band energy deltas (7 bands: sub → air)

## CPB Analysis 🟡 PARTIAL

- ✅ Octave bands
- ✅ 1⁄3 octave bands
- ✅ Region-aware CPB graph
- 🟡 Current method: FFT-bin power summation into nominal fractional-octave bands
- ✅ CPB comparison between files via existing compare workflow
- ✅ CPB comparison UX shows the largest band deltas first, with the full band table below
- ✅ Agent compare/report artifacts can cite strongest CPB band delta
- ✅ Z / A / C weighting controls with explicit weighting metadata
- 🟡 Standards-oriented filter-bank mode via Python sidecar scaffold (`python_filter_bank` method selector + subprocess client); generated 1 kHz and 100 Hz sine fixture validation done, external calibrator/standards validation pending
- ❌ CPB over time

Future method roadmap:

- Keep `fft_bin_power_sum` as the fast interactive diagnostic CPB mode.
- `python_filter_bank` exists as an experimental subprocess sidecar path with generated sine fixture tests; validate it against known external calibrator files before standards claims.
- First candidate library: `PyOctaveBand` (MIT; fractional octave filter bank, A/C/Z weighting, time weighting).
- Secondary candidates: `pyfar` fractional octave filters, `pyfilterbank` fractional octave filter bank.
- Do not claim IEC 61260 compliance for the current C# FFT-bin implementation; label it as nominal FFT-bin CPB analysis.

## Sound Quality Metrics 🟡 PARTIAL

- ✅ Stationary loudness via MoSQITo `loudness_zwst`
- ✅ DIN sharpness via MoSQITo `sharpness_din_st`
- ✅ Daniel-Weber roughness via MoSQITo `roughness_dw`
- ✅ Manual sound-quality panel with method and limitations metadata; runs full-file by default, supports selected waveform regions, and uses direct MoSQITo metric imports to avoid the broad `sq_metrics` package cold-start path
- 🟡 Current values are computed from uncalibrated digital-amplitude WAV samples; use for relative comparison until calibration is implemented
- ❌ Fluctuation strength
- ❌ Tonality
- ❌ Annoyance composite metrics

## Batch Benchmarking ❌ NOT STARTED

- ❌ Batch metric calculation
- ❌ Ranking / sorting / filtering
- ❌ Grouping / tagging
- ❌ Outlier detection
- ❌ Clustering
- ❌ Similarity
- ❌ Report generation

## AI/ML Extensions ❌ NOT STARTED (long-term)

- CLAP for text-to-audio similarity
- BEATs / AudioMAE for audio embeddings
- Anomaly detection
- Similar sound retrieval
- Semantic audio search
- Auto-tagging

---

# 10. Roadmap

## ✅ Milestone 1 — Reliable Manual Analysis Foundation — COMPLETE

All acceptance criteria met:

- ✅ Multi-file import (WAV)
- ✅ Metadata extraction
- ✅ Waveform visualization
- ✅ Spectrum analysis
- ✅ Spectrogram analysis
- ✅ A/B comparison
- ✅ Basic metrics (RMS, peak, crest factor, duration, sample rate, channels)
- ✅ Clipping detection
- ✅ Export analysis result as JSON (via API)
- ✅ Error handling for unsupported files
- ✅ Analysis parameters visible to user

## ✅ Milestone 1.5 — Agent Infrastructure — COMPLETE

All acceptance criteria met:

- ✅ Agent chat panel with message history
- ✅ Agent tool registry and execution loop
- ✅ Agent artifacts panel (9 artifact types)
- ✅ Tool services (analyze, compare, find, workspace, report)
- ✅ File @mentions in chat
- ✅ Compact evidence citations in responses
- ✅ Backend `POST /api/analysis/run` produces LLM-ready summary
- ✅ OpenAI API connected via backend proxy (`POST /api/agent/chat`)
- ✅ Natural language explanation generation (gpt-4o-mini)
- ✅ Agent cites measured evidence in responses
- ✅ Agent suggests next analysis steps
- ✅ API key secured server-side (appsettings.Development.json, gitignored)

## ✅ Milestone 2 — CPB and Sound Quality Layer — COMPLETE

Must-have features:

- ✅ CPB / octave / 1⁄3 octave graphs
- ✅ Loudness
- ✅ Sharpness
- ✅ Roughness
- ✅ A/B sound-quality comparison
- ✅ Metric ranking table across imported files
- ✅ Basic sound-quality summary

## ✅ Milestone 3 — Evidence-Based Agent — COMPLETE

Must-have features:

- ✅ Agent orchestration vertical slice (planner → tools → evidence → grounded answer)
- ✅ `POST /api/agent/ask` endpoint
- ✅ `AgentOrchestrator`, `AgentPlanner`, `ToolExecutionService`, `EvidencePackageBuilder`, `AgentResponseValidator`
- ✅ AgentToolRegistry whitelist (get_metadata, run_basic_metrics, run_spectrum, run_spectrogram, run_cpb, run_sound_quality_metrics, run_event_detection, run_findings)
- ✅ Frontend: `useAgentAsk` hook, `agentAskSlice`, orchestrator workspace artifact dispatch
- ✅ Evidence references, evidence items, confidence, limitations, suggested next steps in response
- ✅ `ToolResultsData` in `AgentAskResult` — all 8 tool outputs forwarded to frontend as structured data
- ✅ `findings_result` artifact type — per-finding cards (severity, type, time range, confidence, title, description)
- ✅ `tool_result` artifact type — labeled-metrics cards for all 7 non-findings tools
- ✅ Evidence citation pills in chat → focus matching workspace artifact by evidence type/file ID; detail cards stay expanded after click
- ✅ Referenced context panel shows files, active selection, analyses used, limitations, and validation warnings
- ✅ Markdown rendering in assistant chat bubbles
- ✅ `run_findings` suggestion chip in agent chat
- ✅ Routing fix: `findings`/`issues` keywords route to orchestrator
- ✅ Agent can summarize findings with grounded evidence
- ✅ JSONL-based Agent behavior eval harness for deterministic facts, no-tool answers, planner prompt contracts, and final-answer grounding rules
- ✅ Agent can explain A/B differences
- ✅ Investigation trace integration (InvestigationTrace record, in-memory store, exposed in AgentAskResult)

## ✅ Milestone 4 — Batch Benchmarking — COMPLETE

All acceptance criteria met:

- ✅ Import and analyze many files (10–100+)
- ✅ Batch metrics calculation
- ✅ Ranking table
- ✅ Outlier detection
- ✅ Reference vs candidate comparison
- ✅ Grouping/tagging files
- ✅ Batch findings
- ✅ Agent summary of batch results
- ✅ Export batch report

## 🔄 Milestone 4.5 — AI-Generated Acoustic Visual Analysis and Expert Plot Specification Planning — IN PROGRESS

**Goal:** Allow the Agent to decide whether a user request needs text, plots, charts, statistics, rankings, tables, investigation cards, reports, or combinations of these. The Agent should behave like an expert acoustic engineer and select the most useful evidence for the question. It should also decide what data goes into each visualization, how signals are combined, how axes are scaled, what units are used, what annotations are shown, and what metadata is required.

**Product positioning:** This milestone transforms AcousticGPT from "chat next to audio plots" into an AI acoustic engineering assistant that can decide what analysis is needed, run deterministic DSP tools, create the right visual evidence, configure plots like an expert, rank/compare results, and explain the engineering meaning.

**Core principle:** The LLM generates UI structure and visualization intent, not data. All numerical values, plots, rankings, statistics, and metrics come from deterministic backend DSP tools. The AI Agent may choose analyses, response blocks, overlay/separation strategy, axes, ranges, annotations, and explanation, but it must never invent or fabricate results.

### Must-have features:

- **Expert Visualization Planner** — decides whether visualization is needed and selects the minimal useful visual evidence for the question.
- **PlotSpecificationPlanner** — emits precise visualization specifications with data sources, axes, units, scales, ranges, overlay strategy, legend labels, annotations, peak markers, metadata display, default zoom, confidence, and result references.
- **Agent Response Block Model** — Agent returns typed response blocks instead of only text:
  - `MarkdownBlock` — explanatory text.
  - `StatisticsBlock` — metrics table/card.
  - `SpectrumChartBlock` — FFT spectrum visualization.
  - `SpectrumOverlayBlock` — shared-axis multi-file/channel/region spectrum comparison.
  - `SpectrogramChartBlock` — time-frequency heatmap.
  - `WaveformChartBlock` — waveform summary/selection.
  - `TimeSeriesMetricBlock` — level/loudness/sharpness/roughness over time.
  - `RankingBlock` — sorted file/source/channel comparison.
  - `MetricComparisonBlock` — side-by-side metric comparison.
  - `PeakTableBlock` — dominant peaks list.
  - `ContributionChartBlock` — source contribution or contributor ranking.
  - `AudioPlayerBlock` — playback with region context.
  - `SuggestedActionsBlock` — next analysis suggestions.
  - `InvestigationCardBlock` — evidence + interpretation + limitations + next test.
  - `ReportSummaryBlock` — mini investigation report.
- **DSP Tool Layer** — tools such as `RunBasicStatistics`, `RunWaveformSummary`, `RunSpectrum`, `RunSpectrumOverlay`, `RunSpectrogram`, `RunCpbAnalysis`, `RunLoudness`, `RunSharpness`, `RunRoughness`, `RunTonality`, `DetectClipping`, `DetectDominantPeaks`, `CompareFiles`, `RankFilesByMetric`, `ComputeSourceContributions`, `CompareMeasuredVsPredicted`, and `CompareBeforeAfterProcessing` return structured results with metadata.
- **Frontend Block Renderer** — `AgentResponseRenderer` renders each block using trusted acoustic visualization components only. The Agent does not produce arbitrary React.
- **Multi-tool Investigation Flow** — one question can trigger several DSP tools and compose results into a unified visual response.
- **Engineering Metadata and Reproducibility** — every plot or visual block includes file/channel/region, sample rate, units, method, parameters, calibration assumptions, result references, timestamp, and warnings.
- **Investigation Trace Integration** — trace captures user question, interpreted intent, selected tools, reasons, tool inputs, result references, selected response blocks, visualization specifications, reasons for each visualization, final answer, confidence, and timestamp.

### Example user experience:

User asks: *"Which of these three fan recordings sounds worse?"*

Agent response composition:
1. Text summary: *"Based on loudness, sharpness, and peak analysis..."*
2. Ranking table: Files ranked by composite metric
3. Loudness/sharpness comparison chart
4. Spectrum overlay of all three files
5. Key findings card (highlights, issues)
6. Suggested next analysis

### Architecture:

1. **Agent Planner** — Interprets intent → plans required DSP tools → plans visual response structure
2. **DSP Tool Layer** — Computes metrics deterministically, returns structured results with full metadata
3. **Agent Response Block Model** — Typed block schema for all visual responses
4. **Frontend Renderer** — Block-type-specific React components using existing chart infrastructure
5. **Safety Constraints** — All plotted data from backend; every block includes source metadata; calibration assumptions clearly stated

### Implementation phases:

- **Phase 1:** ✅ Basic visual response blocks (Markdown, Statistics, Spectrum chart, Ranking, SuggestedActions)
  - Backend: `AgentResponseBlockModels.cs` with typed blocks
  - Backend: `AgentAskResult.Blocks` field added
  - Backend: Updated `AgentPromptBuilder.BuildFinalAnswerSystemPromptWithBlocks()`
  - Frontend: Block type definitions in `agentAskService.ts`
  - Frontend: `AgentResponseBlockRenderer` component
  - Frontend: Individual block components: `MarkdownBlock`, `StatisticsBlock`, `SpectrumChartBlock`, `RankingBlock`, `SuggestedActionsBlock`
  - Frontend: Chat message rendering with block support + fallback to markdown
- **Phase 2:** ✅ Unified visualization — Agent uses Manual mode chart components (mini inline + modal expansion)
  - `AnalysisViewBlock` — References existing analysis results (`spectrum`, `spectrogram`, `cpb`, `soundQuality`, `findings`)
  - Compact card view in chat using Manual Analysis visualization primitives
  - Click to open full modal with all controls
  - Consistent UI between Manual and Agent modes
  - Backend: Agent triggers analysis → stores result → returns view reference
  - Frontend: Mini-view component wraps existing Manual mode components
- **Phase 3:** ✅ Expert Visualization Planner
  - Decide text/statistics/spectrum/spectrogram/waveform/ranking/table/investigation-card response shape
  - Add traceability explaining why each tool and visual block was selected
  - `ExpertVisualizationPlanner.cs` produces `VisualizationPlan` with per-block `Reason` fields
  - `InvestigationTrace.VisualizationPlan` (type `VisualizationPlanTrace`) serialized in `AgentAskResult`
  - Frontend: `visualizationPlanTrace` field on `ChatMessage`; `ThoughtContainer` collapsible `<details>` block renders per-block decisions (blockType pill + reason) above the assistant answer — collapsed by default, styled to match existing `analysisSteps` pattern
- **Phase 4:** ✅ Expert Plot Specification
  - `PlotHints` record in `AgentResponseBlockModels.cs` (`FocusFrequencyHz`, `FrequencyRangeMinHz/MaxHz`, `AnnotationLabel`, `ScaleOverride`)
  - `ExpertVisualizationPlanner.BuildPlotHintsFor` extracts peak-based ±2-octave hints from spectrum evidence
  - `AgentResultBuilder.BuildPlotHintsLookup` maps `resultId → PlotHints`; `AgentAskResult.PlotHintsMap` serialized in response
  - Frontend: `mergeBlocksWithPlotHints` in `useAgentAsk.ts`; `SpectrumCanvas` `annotationFrequencyHz`/`annotationLabel` dashed marker; `AnalysisViewBlock` preview zoomed to focus range
- **Phase 5:** ✅ Multi-Signal and Multi-File Visualizations (spectrum overlay)
  - `SpectrumOverlayBlock` + `OverlaySignal` records in `AgentResponseBlockModels.cs`
  - `ExpertVisualizationPlanner.AddSpectrumOverlayBlockWhenUseful` emits `spectrumOverlay` plan block when 2+ spectrum evidence items are present
  - `AgentResultBuilder.BuildSpectrumOverlayBlocks` maps evidence → `SpectrumOverlayBlock` with per-signal `resultId`/`fileName`/`PlotHints`
  - `AgentAskResult.OverlayBlocks` carries overlay blocks separately from LLM blocks; wired in both orchestrator paths
  - Frontend: `SpectrumOverlayBlockView` fetches all signal results, merges channels into one `SpectrumCanvas`; rendered in `ChatPanel` after LLM blocks
- **Phase 5 (remaining):** Multi-File Visualizations (non-spectrum)
  - Before/after comparisons, channel comparisons, CPB overlays, sound-quality side-by-side
  - Spectrum overlays, multi-file chart comparison, before/after comparisons, channel comparisons, measured-vs-predicted comparisons, selected time-region comparisons, and source contribution comparisons
- **Phase 6:** ✅ Multi-Tool Acoustic Investigations
  - `InvestigationBlock` + `InvestigationSignal` records in `AgentResponseBlockModels.cs`
  - `ExpertVisualizationPlanner.AddInvestigationBlockWhenUseful` emits `investigation` plan block when 2+ different viewable DSP types are present
  - `AgentResultBuilder.BuildInvestigationBlocks` resolves signals with correct `viewType`; `AgentAskResult.InvestigationBlocks` wired in both orchestrator paths
  - Frontend: `InvestigationBlockView` renders per-signal `AnalysisViewBlock` mini-cards in a `SimpleGrid`; expand modal shows full-height cards
- **Phase 7:** Generated Analysis Workflows
  - Let the Agent generate temporary workflows such as Import files → Statistics → Spectrum overlay → Loudness comparison → Ranking → Report summary
- **Phase 8:** Exportable Investigation Reports
  - Export AI-generated acoustic investigations as PDF, HTML, or project reports including plots, tables, metadata, calibration assumptions, and reproducible analysis parameters

### Acceptance criteria:

- AcousticGPT supports AI-generated acoustic visual analysis.
- The Agent dynamically decides whether visual output is needed and does not always create plots.
- The Agent can choose text-only, statistics, plots, charts, rankings, tables, or investigation cards.
- The Agent can combine multiple signals/files/channels in the same chart when useful and separate them when overlay would mislead.
- The Agent can decide plot type, included data, axes, scales, units, ranges, legends, annotations, markers, and metadata.
- The Agent uses predefined trusted acoustic response blocks.
- The frontend renders visualizations using trusted components only.
- The LLM never invents numerical data.
- All chart data, rankings, statistics, and metrics come from deterministic backend DSP tools.
- Every visualization includes units and engineering metadata.
- Calibration assumptions are clearly displayed, especially when SPL is unavailable or assumed.
- Visualization specifications are stored for reproducibility.
- InvestigationTrace captures tool choices, visualization choices, reasons, result references, final answer, and confidence.
- This feature is positioned as a major differentiator against traditional acoustic tools.

---

## ❌ Milestone 5 — Investigation Workspace — NOT STARTED

Long-term features:

- Project memory
- Investigation timeline
- Explicit intent classifier
- Tool policy validator
- AI-generated hypotheses
- Hypothesis ranking
- Safe action recommender
- Suggested next tests
- Reusable analysis cards
- Saved findings
- Report builder
- User feedback on AI findings
- Knowledge base / RAG for standards and previous cases

The future autonomous agent architecture that powers Milestone 5 is specified in detail in
[Section 11 — Future Agent Architecture](#11-future-agent-architecture--controlled-autonomy-roadmap).

Key concepts required for Milestone 5 (all **Future / Not Started**):

| Concept | Status |
|---------|--------|
| Explicit agent intent classification | Future |
| Explicit evidence planning (evidenceNeeded field) | Future |
| Expert visualization planning and plot specifications | Future |
| Tool metadata + safety levels | Future |
| `AgentPlanValidator` / `ToolPolicyValidator` | Future |
| Proposed workspace actions separate from analysis tools | Future |
| Structured hypothesis ranking | Future |
| First-class investigation trace / timeline | Future |
| Autonomy modes (ExplainOnly → ProactiveInvestigation) | Future |
| External knowledge policy | Future |
| Bounded multi-step observation loop | Future |

---

# 11. Future Agent Architecture — Controlled Autonomy Roadmap

> **Status of this section:** Architecture direction only. None of the concepts below are implemented yet unless explicitly marked as Current. Do not implement production code from this section without explicit instruction.

---

## 11.1 Current Architecture Summary

**Status: Current**

The existing agent orchestrator at `POST /api/agent/ask` is already a good controlled agentic workflow. It can be described as:

> **A controlled, evidence-grounded agentic workflow with deterministic shortcuts.**

Current flow:

```
Frontend question + selected file IDs
  → POST /api/agent/ask
  → backend validates request
  → DeterministicFactRouter handles simple factual questions without any LLM call
  → otherwise AgentPlanner calls OpenAI to decide which tools to run
  → planner returns strict JSON action (run_tools | ask_clarification | no_analysis_needed)
  → AgentToolRegistry filters requested tools against a hardcoded whitelist
  → ToolExecutionService runs deterministic backend DSP tools (never the LLM)
  → EvidencePackageBuilder compresses raw tool outputs into structured evidence items
  → second LLM call: AgentPlanner.GenerateFinalAnswerAsync produces grounded explanation
  → AgentResponseValidator checks evidence-reference consistency
  → backend returns answer + evidence refs + tool outputs + confidence + limitations
  → frontend renders deterministic workspace artifacts from tool outputs
```

What is already good about this system:

- Avoids unnecessary LLM calls for simple measured facts (`DeterministicFactRouter`)
- The LLM does not compute DSP values — the backend does
- Backend tools produce the numeric truth
- All tools are whitelisted via `AgentToolRegistry`
- Evidence is packaged before the explanation call (`EvidencePackageBuilder`)
- Final answer is validated against evidence (`AgentResponseValidator`)
- Frontend renders deterministic artifacts — it never fabricates metrics

What it is **not yet**:

- It is not a fully schema-driven autonomous acoustic investigation agent
- The planner uses prompt instructions and keyword rules, not a first-class intent model
- There is no explicit evidence-planning step separate from tool selection
- Tools have no safety levels or autonomy mode metadata
- Proposed workspace actions are not separated from analysis tools
- There is no structured hypothesis ranking
- There is no persistent investigation trace
- There is no multi-step observation loop
- There is no full trace-based agent eval harness with multi-trial scoring, model-graded answer quality, or production monitoring metrics

---

## 11.2 Future Direction

**Status: Future**

The next architectural evolution should move from:

```
question wording / prompt rules → tools → evidence → final answer
```

toward:

```
intent → evidence needed → tools → policy → execution → visualization specs → hypotheses → trace
```

The agent should **not** become an endless list of hardcoded rules:

```
if user says "harsh" → run X
if user says "whine" → run Y
if user says "clipping" → run Z
```

Instead, it should compose a smaller set of reusable concepts:

```
intent classification
  + evidence requirements
  + approved tool capabilities
  + safety policies
  + visualization planning
  + hypothesis ranking
  + investigation trace
```

This is what will make the agent feel like a real acoustic investigation copilot, not just a smart router.

---

## 11.3 Concept 1 — Explicit Agent Intent

**Status: Future**

The future planner should output a first-class `intent` field in the planning response.

**Intent vocabulary:**

| Intent | Meaning |
|--------|---------|
| `general_diagnosis` | Open-ended "tell me about this file" investigation |
| `compare_files` | A vs B or multi-file comparison |
| `explain_perception` | Why does this sound harsh/annoying/tinny/etc. |
| `detect_specific_issue` | Is there clipping / silence / a tonal peak? |
| `rank_candidates` | Which product is best? Rank all loaded files. |
| `suggest_modification` | How could this be improved? |
| `generate_report` | Produce a structured engineering report |
| `ask_method_question` | How is X calculated? (no analysis needed) |
| `search_external_context` | Look up a standard / datasheet / benchmark |

**Mapping examples:**

```
"Why does this sound annoying?"     → explain_perception
"Is there clipping?"                → detect_specific_issue
"Why is Product B worse than A?"    → compare_files
"Which product is best?"            → rank_candidates
"Can you reduce the whine?"         → suggest_modification
"Generate a report"                 → generate_report
```

**Future planner JSON:**

```json
{
  "action": "run_tools",
  "intent": "explain_perception",
  "confidence": 0.86,
  "tools": []
}
```

**Why this matters:** Intent lets the backend understand *why* the user is asking, not only *which tool the LLM selected*. It enables downstream components (hypothesis ranker, report builder, policy validator) to apply intent-appropriate logic without hard-coded keyword rules.

---

## 11.4 Concept 2 — Explicit Evidence Planning

**Status: Future**

The future planner should **not** jump directly from question wording to tool names.

It should first identify what *evidence types* are needed, then derive which tools will produce them. This separates the "what do we need to know?" question from the "which function computes it?" question.

**Evidence type vocabulary:**

```
metadata
basic_metrics
spectrum
spectrogram
cpb
sound_quality_metrics
event_detection
findings
reference_comparison
similarity
external_context
```

**Example:**

```
Question: "Why does this sound harsh?"
→ Intent: explain_perception
→ Evidence needed: sharpness, roughness, cpb, spectrum, findings
→ Tools: run_sound_quality_metrics, run_cpb, run_spectrum, run_findings
```

**Future planner JSON with evidence planning:**

```json
{
  "action": "run_tools",
  "intent": "explain_perception",
  "confidence": 0.86,
  "evidenceNeeded": [
    "basic_metrics",
    "spectrum",
    "cpb",
    "sound_quality_metrics",
    "findings"
  ],
  "tools": [
    {
      "name": "run_basic_metrics",
      "arguments": {},
      "reason": "Needed to inspect level and dynamics."
    },
    {
      "name": "run_spectrum",
      "arguments": {},
      "reason": "Needed to detect tonal peaks and spectral balance."
    },
    {
      "name": "run_cpb",
      "arguments": {},
      "reason": "Needed to inspect frequency-band energy distribution."
    },
    {
      "name": "run_sound_quality_metrics",
      "arguments": {},
      "reason": "Needed to estimate loudness, sharpness, and roughness."
    },
    {
      "name": "run_findings",
      "arguments": {},
      "reason": "Needed to collect structured issues such as clipping or tonal peaks."
    }
  ],
  "proposedActions": [],
  "requiresUserConfirmation": false
}
```

**Note:** The `reason` field per tool makes the planner's intent legible to the backend validator and to the user ("How I analyzed this" panel), without relying on keyword matching in prompt rules.

---

## 11.5 Concept 3 — Expert Visualization Planning and Plot Specifications

**Status: Future**

The future planner should not merely say "show a plot." It should produce a visualization plan that explains whether visual evidence is needed, what block types should be returned, which results should feed each block, and how each plot should be configured.

This layer contains two concepts:

- **Expert Visualization Planner** — chooses the response format and visual evidence strategy.
- **PlotSpecificationPlanner** — converts available result references into precise plot specifications.

**Future visualization plan JSON:**

```json
{
  "responseBlocks": [
    {
      "type": "markdown",
      "reason": "Briefly explain the comparison result before showing evidence."
    },
    {
      "type": "spectrumOverlay",
      "reason": "The user is comparing files and spectra share frequency and level axes.",
      "plotSpecification": {
        "title": "Spectrum overlay - Reference vs Candidate",
        "dataSources": [
          { "resultRef": "spectrum_ref_001", "label": "Reference", "channel": "Mono" },
          { "resultRef": "spectrum_candidate_001", "label": "Candidate", "channel": "Mono" }
        ],
        "xAxis": { "label": "Frequency", "unit": "Hz", "scale": "linear", "min": 20, "max": 10000 },
        "yAxis": { "label": "Level", "unit": "dBFS", "scale": "dB", "autoScale": false },
        "displayOptions": {
          "showLegend": true,
          "showGrid": true,
          "showPeakMarkers": true,
          "showMetadata": true
        }
      }
    }
  ]
}
```

**Visualization planning rules:**

- When the user asks for "a plot" without specifying plot type, infer the best plot from the acoustic question and return the reason. Examples: choose a spectrum for "around 1 kHz" or tonal/frequency questions; choose a spectrogram for "over time", drift, bursts, or intermittent tones; choose a waveform for clipping/transients/edits; choose ranking or metric comparison blocks for "which is worse/better/louder/sharper." If more than one plot is useful, include complementary blocks or state the alternative next view.
- Use text only for definitions, method explanations, or questions where a visual adds no evidence.
- Use statistics blocks for compact numerical summaries.
- Use spectrum plots for frequency content, tones, peaks, harmonics, resonances, and spectral differences.
- Use spectrum overlays when compared signals share axes/units and overlay is readable.
- Use spectrograms for time-varying sound, transient events, tonal drift, or intermittent tones.
- Use waveform plots for clipping, transients, edits/cuts, and region selection.
- Use time-series metric plots for loudness, sharpness, roughness, level, or tonality over time.
- Use bar charts for rankings, contributors, source contribution, top frequencies, and metric comparisons.
- Use tables when exact values and traceability matter.
- Use investigation cards for broad diagnostic questions requiring multiple evidence types.

**Trust requirements:**

- Every visual block must reference deterministic `resultId` or `dataRef` values.
- Axis units, scale changes, smoothing, filtering, averaging, normalization, zooming, and calibration assumptions must be visible.
- Fixed scales should be used for fair comparisons; auto-scale may be used for single-signal inspection when clearly labeled.
- Visualization specifications must be stored in `InvestigationTrace` so users can inspect how each plot was configured.

---

## 11.6 Concept 4 — Tool Metadata and Tool Policy

**Status: Future (current `AgentToolRegistry` only implements the whitelist check)**

The existing whitelist answers one question:

```
Is this tool allowed?
```

In the future, each tool entry in `AgentToolRegistry` should carry richer metadata so the policy engine can answer:

```
What evidence does this tool produce?
Is this tool safe to run automatically?
Does it require user confirmation before running?
Is it read-only, preview-only, destructive, or external?
Which autonomy modes allow this tool?
```

**Proposed future tool metadata fields:**

```
name
description
inputSchema
outputSchema
evidenceProduced          ← list of evidence types this tool emits
safetyLevel               ← see safety levels below
requiresConfirmation      ← boolean
allowedAutonomyModes      ← list of autonomy modes (see Concept 8)
limitations               ← known accuracy or scope limitations
```

**Proposed safety levels:**

| Level | Name | Description |
|-------|------|-------------|
| 1 | `read_only_analysis` | Reads audio, produces metrics. No workspace change. |
| 2 | `view_navigation` | Opens a plot, focuses a region, adds a marker. Visible but reversible. |
| 3 | `temporary_preview` | Creates a temporary filter preview or annotation. Not persisted. |
| 4 | `destructive_or_external` | Permanently modifies data, uploads externally, or changes the project. Requires confirmation. |

**Examples:**

| Tool / Action | Safety Level | Confirmation Required |
|---------------|-------------|----------------------|
| `run_spectrum` | Level 1 — read-only analysis | No |
| `run_cpb` | Level 1 — read-only analysis | No |
| `run_sound_quality_metrics` | Level 1 — read-only analysis | No |
| `focus_frequency_region` | Level 2 — view/navigation | No, but visible |
| `create_marker` | Level 2 — view/navigation | Usually no |
| `preview_notch_filter` | Level 3 — temporary preview | Usually no if clearly temporary |
| `apply_filter_permanently` | Level 4 — destructive | Yes |
| `upload_audio_externally` | Level 4 — external | Yes |

**Implementation note:** No changes to `AgentToolRegistry.cs` should be made until this concept is being explicitly implemented. Add this as a TODO comment when the time comes.

---

## 11.7 Concept 5 — Agent Plan Validation

**Status: Future**

Prompt instructions are not enough as a safety guardrail for a more autonomous agent.

The future backend should have a dedicated `AgentPlanValidator` (or `ToolPolicyValidator`) component that runs *before* `ToolExecutionService` and validates the full plan, not just the tool names.

**Responsibilities:**

```
validate planner action (is "run_tools" a supported action?)
validate intent (is the declared intent in the known vocabulary?)
validate evidenceNeeded types (are they in the supported evidence type list?)
validate tool names (against the registry whitelist)
validate selected file IDs (do they exist in the project?)
validate tool arguments (type-check against each tool's input schema)
validate safety level (does the plan require user confirmation?)
validate autonomy mode (does the current mode permit this plan?)
reject unsupported or unsafe plans with a structured error
require confirmation for Level 3/4 actions before execution
```

**Core principle:**

```
The LLM proposes.
The backend approves.
The backend executes.
```

This is more robust than relying on prompt wording alone, especially when autonomy modes expand and the planner may request workspace-modifying actions.

---

## 11.8 Concept 6 — Proposed Actions Separate from Analysis Tools

**Status: Future**

The future agent should clearly distinguish two categories of operations:

**Analysis tools** — produce evidence, do not modify the workspace:

```
run_spectrum
run_cpb
run_sound_quality_metrics
run_event_detection
run_findings
run_basic_metrics
get_metadata
```

**Workspace actions** — change or prepare the UI/workspace:

```
focus_frequency_region
focus_time_region
open_relevant_plot
highlight_finding
create_marker
create_temporary_filter_preview
```

The planner JSON should separate these into `tools` and `proposedActions` arrays, with each proposed action carrying its safety level and a `requiresConfirmation` flag.

**Future planner output example:**

```json
{
  "action": "run_tools",
  "intent": "detect_specific_issue",
  "confidence": 0.91,
  "evidenceNeeded": ["spectrum", "findings"],
  "tools": [
    {
      "name": "run_spectrum",
      "arguments": {},
      "reason": "Detect narrowband tonal components."
    },
    {
      "name": "run_findings",
      "arguments": {},
      "reason": "Generate structured issue findings."
    }
  ],
  "proposedActions": [
    {
      "name": "focus_frequency_region",
      "arguments": {
        "centerHz": 685,
        "widthHz": 300
      },
      "reason": "Focus the UI around the detected tonal peak.",
      "safetyLevel": "view_navigation",
      "requiresConfirmation": false
    }
  ]
}
```

**Note:** The current system already has a frontend workspace tool loop (`getState`, `analyze`, `workspace`, `report`). The future architecture formalizes workspace actions as a first-class concept with safety metadata, rather than a separate client-side dispatch path.

---

## 11.9 Concept 7 — Structured Hypothesis Ranking

**Status: Future**

The future agent should not only explain evidence in prose. It should produce **structured ranked hypotheses** before the final natural-language answer, so explanations are grounded in ranked candidates, not just the first plausible interpretation.

**Example hypothesis output:**

```json
[
  {
    "hypothesis": "Tonal whine at 685 Hz",
    "confidence": "high",
    "supportingEvidence": [
      "tonal_peak_685Hz",
      "cpb_band_delta_630Hz"
    ],
    "contradictingEvidence": [],
    "nextStep": "Check whether the tone follows RPM/order data."
  },
  {
    "hypothesis": "Clipping distortion",
    "confidence": "low",
    "supportingEvidence": [],
    "contradictingEvidence": [
      "no_clipping_detected"
    ],
    "nextStep": "No clipping follow-up needed."
  }
]
```

The hypothesis layer must distinguish:

```
measured facts           ← directly from tool outputs
inferred hypotheses      ← derived from evidence
unsupported explanations ← flagged explicitly as without evidence
contradicting evidence   ← evidence that argues against a hypothesis
limitations              ← scope of what was and was not measured
suggested next tests     ← grounded in the ranked hypotheses
```

This is one of the key features that will make the agent feel like an autonomous acoustic investigator rather than a prose generator.

---

## 11.10 Concept 8 — Investigation Trace / Timeline

**Status: Future**

The current response is good for chat. The future product should store a **first-class investigation trace** that captures the full reasoning path for every question answered.

**Future investigation record:**

```json
{
  "question": "Why does Product B sound harsher than Product A?",
  "path": "llm_planned",
  "intent": "explain_perception",
  "plan": {
    "evidenceNeeded": [
      "basic_metrics",
      "spectrum",
      "cpb",
      "sound_quality_metrics",
      "findings"
    ],
    "tools": [
      "run_basic_metrics",
      "run_spectrum",
      "run_cpb",
      "run_sound_quality_metrics",
      "run_findings"
    ]
  },
  "toolsRun": [],
  "parameters": {},
  "evidenceUsed": [],
  "responseBlocks": [],
  "visualizationSpecifications": [],
  "visualizationReasons": [],
  "hypotheses": [],
  "actionsTaken": [],
  "finalAnswer": "",
  "confidence": "medium",
  "limitations": [],
  "suggestedNextSteps": [],
  "timestamp": ""
}
```

The investigation trace will support:

```
reproducibility          ← same question → same tools → same evidence → same answer
debugging                ← why did the agent say that?
visual auditability      ← why this plot/table/ranking was selected and how it was configured
report generation        ← trace feeds directly into a structured report
investigation timeline   ← user can see the history of all questions asked in a session
project memory           ← past investigations inform future ones
auditability             ← every claim references measured evidence
user trust               ← users can inspect the full reasoning path
```

At minimum, InvestigationTrace should capture:

- User question.
- Interpreted intent.
- Selected tools and reason for each selected tool.
- Tool inputs and result references.
- Selected response blocks.
- Visualization specifications and reason for each visualization.
- Final answer.
- Confidence.
- Timestamp.

---

## 11.11 Concept 9 — Autonomy Modes

**Status: Future**

The future agent should support configurable **autonomy modes** so users can control how much the agent is allowed to do autonomously.

**Proposed modes:**

| Mode | Description |
|------|-------------|
| `ExplainOnly` | The agent can analyze and explain evidence. It does not change the workspace. |
| `AssistiveAutonomy` | The agent can run analyses, open relevant plots, focus time/frequency regions, create markers, and generate temporary previews. |
| `ProactiveInvestigation` | The agent can run multi-step investigations, generate ranked hypotheses, compare many files, suggest next tests, create temporary previews, and draft reports. |
| `StrictApproval` | The agent asks for explicit user confirmation before every action, including read-only analyses. |

**Intended default:** `AssistiveAutonomy`.

**Note:** Do not change current behavior to match any of these modes until autonomy mode support is explicitly implemented. The current system behaves roughly like `ExplainOnly` without the formal mode structure.

---

## 11.12 Concept 10 — External Knowledge Policy

**Status: Future**

The future agent may use external knowledge: standards documents, product specs, datasheets, or benchmark databases. The documentation and implementation must clearly distinguish the provenance of every claim.

**Knowledge source types:**

```
measured_acoustic_evidence  ← from backend DSP tools — primary source of truth
project_benchmark_data      ← validated project-specific reference data
validated_standard          ← documented, versioned, validated external standard
internet_context            ← general background context, not measurement evidence
unverified_external         ← flagged and not used for quantitative claims
```

**Rules:**

```
Internet data can provide background context.
Internet data is not measured acoustic evidence.
Validated project/benchmark data is preferred over general internet context.
Public internet sources must not be used to claim a recording is objectively better or worse
  unless the benchmark is validated and comparable.
Uploading audio externally requires explicit user confirmation (Level 4 safety action).
The agent must never mix unverified external data with measured acoustic evidence
  without clearly labeling the source difference.
```

---

## 11.13 Concept 11 — Bounded Multi-step Observation Loop

**Status: Future**

The current system plans once, runs tools in parallel, and answers. This is efficient and appropriate for most questions.

The future autonomous version may use a **bounded observation loop** for complex investigations that benefit from iterative evidence gathering:

```
plan
  → execute approved tools
  → observe evidence
  → decide whether more evidence is needed (LLM observation step)
  → if yes: execute additional approved tools
  → repeat until sufficient evidence or max iterations reached
  → produce ranked hypotheses and final answer
```

**Required constraints (must be enforced, not just prompted):**

```
max tool calls per question        ← hard limit, not a prompt instruction
max planning iterations            ← prevents infinite loops
cost / time budget limits          ← stops runaway investigations
no destructive actions without confirmation at any iteration
no external upload without confirmation at any iteration
clear stopping condition           ← "enough evidence" or "max iterations"
```

This loop is only appropriate for complex multi-hypothesis investigations (e.g., "Why does Product B fail the sound quality acceptance test?"). Single-question responses should continue to use the current single-planning-pass approach.

---

## 11.14 Concept 12 — Core Product Principle

**Status: Current (principle) / Future (full execution)**

> **The agent is disruptive because it owns the investigation workflow — not because it is a generic chatbot.**

The future acoustic agent should feel like:

> An acoustic investigation copilot that classifies the user's intent, plans what evidence is needed, runs approved deterministic tools, ranks competing explanations against that evidence, surfaces limitations and unsupported claims, suggests grounded next tests, and builds reproducible investigation reports.

Not:

> A chatbot that guesses things about audio.

This principle applies to every design decision in the agent architecture. Any feature that adds chattiness without evidence grounding moves the product in the wrong direction. Any feature that adds evidence coverage, hypothesis ranking, or investigation reproducibility moves it in the right direction.

---

## 11.15 Implementation TODOs for Future Architecture

These items must be explicitly assigned before any implementation begins.

```
TODO [Concept 1]:  Add `intent` field to PlannerResponse model
                   Extend AgentPromptBuilder planner system prompt with intent vocabulary
                   Validate intent in AgentOrchestrator before tool execution

TODO [Concept 2]:  Add `evidenceNeeded` and `reason` fields to PlannerResponse and PlannerToolRequest
                   Update AgentPromptBuilder to instruct LLM to populate evidenceNeeded
                   Use evidenceNeeded in EvidencePackageBuilder to validate coverage

TODO [Concept 3]:  Add ExpertVisualizationPlanner and PlotSpecificationPlanner contracts
                   Add responseBlocks and visualizationSpecifications to planner/final-answer contracts
                   Store visualization specs and reasons in InvestigationTrace
                   Ensure every visual spec references deterministic resultId/dataRef values

TODO [Concept 4]:  Extend AgentToolDefinition with safetyLevel, requiresConfirmation,
                   evidenceProduced, allowedAutonomyModes, limitations fields
                   No behavior change — metadata only until policy engine is added

TODO [Concept 5]:  Create AgentPlanValidator (or ToolPolicyValidator) class
                   Move whitelist check from AgentOrchestrator into this class
                   Add intent validation, argument schema validation, safety level check

TODO [Concept 6]:  Add proposedActions array to PlannerResponse
                   Create WorkspaceAction model with name, arguments, safetyLevel, requiresConfirmation, reason
                   Route workspace actions through a separate execution path from analysis tools

TODO [Concept 7]:  Add HypothesisRanker component
                   Define Hypothesis record type with confidence, supportingEvidence, contradictingEvidence, nextStep
                   Integrate hypothesis list into AgentAskResult response contract

TODO [Concept 8]:  Create InvestigationTrace record type
                   Persist trace per question in the backend (in-memory first, database later)
                   Expose trace in AgentAskResult so frontend can show "How I investigated this"

TODO [Concept 9]:  Add AutonomyMode enum and configuration
                   Pass mode through AgentAskCommand
                   Use mode in AgentPlanValidator to gate Level 2/3/4 actions

TODO [Concept 10]: Add KnowledgeSourceType enum to EvidenceItem and FinalAnswerResponse
                   Implement external knowledge policy rules in AgentResponseValidator
                   Never add external upload functionality without explicit confirmation flow

TODO [Concept 11]: Design bounded observation loop as a separate orchestration path
                   Add MaxToolCallsPerQuestion and MaxPlanningIterations configuration
                   Implement stopping condition check in loop controller

TODO [Concept 12]: Add AgentRunTrace and trace-based eval harness
                   Implement after the current JSONL contract evals are stable and before
                   adding higher-autonomy investigation loops, batch-ranking explanations,
                   or report generation.
                   Trace must capture: user question, selected files, deterministic route/no-tool route,
                   planner response, planned tools, tool args, tool output refs, evidence package,
                   final answer, validation warnings, latency, token usage, and model id.

TODO [Concept 13]: Add end-to-end agent eval suite with audio fixtures
                   Implement after AgentRunTrace exists and before changing planner prompts,
                   upgrading models, or expanding Agent tools beyond the current DSP suite.
                   Each eval case should define expected tools, expected evidence types,
                   prohibited claims, required answer facts, and outcome graders over the
                   trace/final answer.

TODO [Concept 14]: Add multi-trial and model-graded evals
                   Implement when the Agent begins producing richer comparative reports,
                   recommendations, or autonomous next-step plans where deterministic graders
                   are insufficient.
                   Track pass@1/pass^k-style consistency, tool-call stability,
                   unsupported-claim rate, latency, cost, and answer-quality rubric score.

TODO [Concept 14]: Add human calibration loop for agent evals
                   Implement before treating model-graded eval scores as release gates.
                   Acoustic/domain experts should periodically review sampled traces and
                   calibrate rubric prompts for groundedness, usefulness, uncertainty,
                   and acoustic validity.

TODO [General]:    All future architecture work should be introduced as thin vertical slices.
                   Do not implement the full multi-concept stack at once.
                   The current single-planning-pass orchestrator must remain working
                   until each slice is tested and validated.
```
8. Edge cases
9. Suggested implementation order
10. Any assumptions or questions

When I ask for code, please:

1. Keep it aligned with this architecture
2. Create a thin vertical slice
3. Avoid unnecessary abstractions
4. Include clear names
5. Include tests where appropriate
6. Avoid placeholder/fake analysis values
7. Document assumptions

When I ask for sprint planning, please:

1. Break work into small stories
2. Prioritize end-to-end value
3. Identify blockers
4. Identify technical risks
5. Suggest a realistic sprint goal
6. Include Definition of Done

---

# 12. Suggested Next Priorities (after current state)

Given the current state, the recommended next work is:

1. ~~Connect OpenAI API~~ ✅ Done
2. ~~Findings Panel~~ ✅ Done — Structured findings from event detection + level analysis
3. ~~Tonal peak detection~~ ✅ Done — Local prominence heuristic in spectrum analyzer + findings
4. ~~CPB analysis~~ 🟡 Partial — Backend + manual CPB panel, comparison, Z/A/C weighting controls, experimental `python_filter_bank` sidecar path, and generated-WAV validation tests done; external calibrator validation pending
5. ~~Sound quality metrics: loudness + sharpness + roughness~~ ✅ First slice done — MoSQITo sidecar, backend endpoint, manual panel, direct metric imports, and generated-WAV validation
6. ~~Agent findings investigation flow~~ ✅ Done — `run_findings` wired into orchestrator; `findings_result` and `tool_result` workspace artifacts; compact evidence citation pills focus matching artifacts and keep detail cards expanded; markdown rendering
7. ~~Python packages installed~~ ✅ Done — `mosqito==1.2.1`, `PyOctaveBand==1.2.2` installed in system Python 3.13; sidecar path configured
8. ~~Sound-quality comparison~~ ✅ Done — Loudness/sharpness/roughness deltas are included in A/B comparison UI, pairwise diffs, and agent evidence
9. **Next UX/UI iteration** — Turn the current analysis workspace from "many panels" into a clearer guided investigation flow before adding more large feature surface
10. **Next: Batch benchmarking** — Add multi-file ranking, clustering, outlier detection, and report-ready benchmark summaries

## UX/UI Review Backlog — Added 2026-06-10

The product is directionally strong: it feels like a technical acoustic investigation tool, not a generic chatbot or DAW. The main UX risk is that the interface can feel like a collection of analysis panels rather than a guided workflow from file import to evidence, interpretation, and next action.

### Critical UX Tasks

1. **Agent response status clarity** ✅ Done (2026-06-14) — `AgentActivityIndicator` component with live status labels
   - Problem: Long-running agent analysis can feel stalled if the user only sees a generic loading state.
   - Why it matters: Trust drops quickly when analysis status is ambiguous, especially for MoSQITo and multi-file workflows.
   - Target pattern: One assistant bubble per request with visible user-facing activity states: planning, running tools, building evidence, generating answer, failed.
   - Acceptance criteria:
     - ✅ A request never shows duplicate temporary assistant bubbles.
     - ✅ The active assistant bubble shows the current status.
     - ✅ Final answer, evidence, next steps, and errors appear in that same bubble.
     - ✅ Long-running tools show a clear tool/activity label.

2. **Guided investigation workflow** ✅ Done (2026-06-14) — `InvestigationStartPrompt` CTA tiles + sidebar `Open` badges
   - Problem: After loading a file, users may not know whether to open tools, read findings, ask the agent, or inspect plots.
   - Why it matters: New users need a clear next action; expert users need faster triage.
   - Target pattern: File loaded -> suggested analyses -> key findings -> evidence-backed next actions.
   - Acceptance criteria:
     - ✅ Empty or sparse workspace states suggest the next useful analysis.
     - Findings and key summaries are visually prioritized over raw controls.
     - Agent and manual workflows point to the same evidence model.

### Important UX Tasks

3. **Manual analysis layout hierarchy**
   - Problem: Panels can feel scattered across a large canvas and relationships between findings, spectrum, spectrogram, CPB, and sound quality are not always obvious.
   - Why it matters: Users need to scan and compare results quickly.
   - Target pattern: Keep the responsive grid, but strengthen hierarchy with a primary result area, key findings, and consistent secondary panels.
   - Acceptance criteria:
     - The default manual workspace has an obvious first reading path.
     - Panel headers, controls, and results use consistent sizing and spacing.
     - Empty regions are replaced with meaningful placeholders or recommended next steps.

4. **Reusable analysis result card pattern**
   - Problem: Different panels present controls, method metadata, key takeaways, and visualizations differently.
   - Why it matters: Inconsistent presentation increases cognitive load and makes the product feel less polished.
   - Target pattern: Each analysis card has title, compact controls, key takeaway, visualization, method/limitations, and evidence hooks.
   - Acceptance criteria:
     - Spectrum, CPB, sound quality, findings, and comparison cards share a recognizable structure.
     - Key metric/takeaway text is more visually prominent than configuration metadata.
     - Method and limitation details remain available without dominating the card.

5. **Tool discoverability and click targets**
   - Problem: Icon-only or narrow tool controls can be unclear; users may not know whether icon, label, or row is clickable.
   - Why it matters: Tool invocation is core to the workflow.
   - Target pattern: Full-row clickable tool items with icon, label, active state, hover state, and tooltip.
   - Acceptance criteria:
     - Clicking either icon or label triggers the same tool action.
     - Active/open tools are visually distinct.
     - Every non-obvious icon has a tooltip.

6. **Readability and visual polish**
   - Problem: Some secondary labels, timestamps, and metadata can be too faint; panel density and blank space are uneven.
   - Why it matters: Low contrast and inconsistent density reduce trust and slow scanning.
   - Target pattern: Stronger text contrast, consistent panel rhythm, and fewer ultra-muted labels outside disabled states.
   - Acceptance criteria:
     - Secondary text is readable on laptop displays.
     - Disabled states are visually distinct from ordinary metadata.
     - Panel padding, header height, borders, and control sizing are consistent.

### Nice-To-Have UX Tasks

7. **Metric education without clutter**
   - Problem: Loudness, sharpness, roughness, CPB, and spectrogram settings can be opaque to non-expert users.
   - Why it matters: Users need enough context to trust and interpret metrics without turning the UI into documentation.
   - Target pattern: Tooltips, compact "what this means" affordances, or expandable method notes.
   - Acceptance criteria:
     - Help text is available on demand.
     - Always-visible UI remains focused on results and next actions.

8. **Usability validation script**
   - Problem: UX assumptions need validation before heavy engineering investment.
   - Why it matters: The product direction is specialized; real user behavior matters.
   - Validation tasks:
     - "You uploaded a WAV file. What would you click first?"
     - "Find why one file sounds harsher than another."
     - "Tell me what evidence supports the agent answer."
     - "Find the sound-quality metrics."
     - "Compare two files and identify the biggest difference."
     - "Explain what the current finding means."
     - "Identify which controls are clickable."
     - "Tell me when the app feels stuck or unclear."

---

# 12b. Generative UI — Phase 2 Planned Features

These are agent chat UI features where the agent generates visual blocks inline in the chat. All require deterministic backend data — the LLM generates structure, not values.

## Multi-file Overlay Chart (spectrum comparison)

**User says:** *"Show me a spectrum comparison of all 3 files"* or *"Plot the spectrum for all files on the same graph"*

**What it needs:**
- Backend: `AnalysisResultCache.StoreMultiResult(resultIds[], type)` — groups per-file results under one combined ID
- Block type: `analysisView` gets optional `resultIds: string[]` (multiple files) alongside existing `resultId`
- Frontend: `useAnalysisResult` fetches all IDs in parallel; `SpectrumViewer` already accepts multi-channel — wire per-file as separate channels with file name as channel label
- Prompt rule: when user asks to compare/overlay spectra across files, emit one `analysisView` block with all `resultIds`

**Status:** ❌ Not started

---

## CPB Multi-file Overlay Chart

**User says:** *"Compare the CPB of all files"* or *"Which file has more low-frequency energy?"*

**What it needs:**
- Same `resultIds[]` pattern as spectrum overlay
- `CpbViewer` needs multi-file overlay mode (grouped bars or overlaid lines per file)
- Planner prompt rule: CPB comparison → single `analysisView` block with all `resultIds`

**Status:** ❌ Not started

---

## Sound Quality Radar / Spider Chart

**User says:** *"Show me the psychoacoustic profile of all files"* or *"Compare loudness, sharpness, roughness across products"*

**What it needs:**
- New block type: `radarChart` — `{ blockType: "radarChart", metrics: [{ fileId, fileName, loudness, sharpness, roughness }] }`
- Frontend: radar/spider chart component using `@mantine/charts` or a lightweight canvas renderer
- No new backend endpoint needed — data comes from existing `run_sound_quality_metrics` evidence

**Status:** ❌ Not started

---

## Findings Summary Block

**User says:** *"What issues did you find?"* or *"Run a full diagnostic"*

**What it needs:**
- New block type: `findingsSummary` — compact severity-coded list inline in chat (not just a modal link)
- Each finding row: icon + severity badge + short description + "View detail" → opens findings modal
- Already have `FindingsViewer` — wire it as the modal target via `analysisView` with `viewType: "findings"`

**Status:** 🟡 Partially wired — `analysisView` with findings viewer exists but agent doesn't always emit it for findings queries

---

## Spectrogram Thumbnail Block

**User says:** *"Show me the spectrogram"* or *"What does the time-frequency content look like?"*

**What it needs:**
- `analysisView` with `viewType: "spectrogram"` — currently defined in types but spectrogram viewer not wired into `AnalysisViewModalContent`
- Store spectrogram result in `AnalysisResultCache` during `run_spectrogram` execution
- Thumbnail preview: base64 image (already computed by `SpectrogramAnalyzer`) shown inline before modal opens

**Status:** ❌ Not started

---

## Investigation Timeline Block

**User says:** *"What analysis did you run and why?"* or *"Show me your investigation steps"*

**What it needs:**
- New block type: `investigationTimeline` — ordered list of tool calls with status, duration, and one-line summary of what each tool found
- Data already exists in `InvestigationTrace` returned in `AgentAskResult`
- Frontend: collapsible step-by-step trace block

**Status:** ❌ Not started

---

## Annotated Frequency Marker Block

**User says:** *"Mark the tonal peak at 1 kHz on the spectrum"* or *"Show me where the clipping is"*

**What it needs:**
- `SpectrumCanvas` already renders the chart — needs an `annotations` prop: `{ frequencyHz, label, color }[]`
- Agent emits `frequenciesHz` + `annotationMarkers` in the `analysisView` preview
- Useful for findings: each tonal peak finding → one annotation marker on the spectrum

**Status:** ❌ Not started

---

# 13. Backlog Epics

1. ~~Project and file import~~ ✅
2. ~~Metadata and signal overview~~ ✅
3. ~~Manual signal analysis~~ ✅
4. ~~Spectrum and spectrogram~~ ✅
5. CPB analysis
6. Sound-quality metrics
7. ~~A/B comparison~~ ✅
8. ~~Findings engine~~ ✅
9. Agent explanation layer (OpenAI integration)
10. Batch benchmarking
11. Similarity and embeddings
12. Report generation
13. Project memory
14. Validation and feedback
15. Export and reproducibility
16. UX/UI investigation workflow polish

---

# 14. Immediate User Stories

## Story 1 — Multi-File Import ✅ DONE

## Story 2 — Basic Metrics ✅ DONE

## Story 3 — Spectrum Analysis ✅ DONE

## Story 4 — Spectrogram Analysis ✅ DONE

## Story 5 — CPB Graph ✅ DONE

As a user, I want to view a 1⁄3 octave CPB graph so that I can evaluate sound energy by frequency band.

Acceptance criteria:

- ✅ User can generate CPB graph
- ✅ Bands are labelled clearly
- ✅ Units are clear
- ✅ Parameters are visible
- ❌ Result can be compared between files (deferred to comparison slice)

## Story 6 — Sound Quality Metrics 🟡 PARTIAL

As a user, I want to calculate loudness, sharpness, and roughness so that I can compare perceived sound quality.

Acceptance criteria:

- ✅ Backend orchestrates sound-quality metrics
- ✅ MoSQITo is used through a Python sidecar
- ✅ Results include units and method metadata
- ✅ Errors are handled clearly
- ✅ Results can be compared between two files via comparison sound-quality deltas

## Story 7 — A/B Comparison ✅ DONE

## Story 8 — Evidence-Based Agent Explanation ✅ DONE

As a user, I want the agent to explain a selected analysis result so that I understand what the data means.

Acceptance criteria:

- ✅ Agent receives structured analysis JSON (via `ToolResultsData` in `AgentAskResult`)
- ✅ Agent cites measured evidence (grounded via `EvidencePackageBuilder`)
- ✅ Agent avoids unsupported claims (validated by `AgentResponseValidator`)
- ✅ Agent suggests one useful next step
- ✅ Agent states when evidence is insufficient (limitations field)
- ✅ Agent answer creates inspectable workspace artifacts for all 7 orchestrator tools

## Story 9 — Findings Panel ✅ DONE

As a user, I want to see detected findings so that I can quickly understand possible issues in the recording.

Acceptance criteria:

- ✅ Findings are generated from backend analysis results
- ✅ Findings include type, severity, confidence, and evidence
- ✅ Findings are visible in a dedicated panel
- ✅ User can click a finding to see related evidence (evidence chips in panel)
- ✅ Agent can trigger findings via "Detect findings and issues" suggestion chip → `run_findings` → `findings_result` workspace card

## Story 10 — Batch Comparison ❌ FUTURE

As a user, I want to analyze many files so that I can rank and compare product recordings.

---

# 15. API Contracts

## Existing Endpoints (implemented)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/audio/upload` | POST | Upload audio file |
| `/api/analysis?fileId={id}` | GET | Level analysis + file info |
| `/api/analysis/spectrum` | POST | FFT spectrum analysis |
| `/api/analysis/spectrogram` | POST | STFT spectrogram analysis |
| `/api/analysis/compare` | POST | Multi-file comparison |
| `/api/analysis/find` | POST | Event detection |
| `/api/analysis/run` | POST | Agent-friendly DSP summary |
| `/api/audio/playback/control` | POST | Playback commands |
| `/api/audio/playback/state/{fileId}` | GET | Query playback state |
| `/api/audio/file/{fileId}` | GET | Stream audio file |
| `/api/waveform?fileId={id}&points={n}` | GET | Downsampled waveform |
| `/api/analysis/findings` | POST | Generate structured findings for a file |

## Planned Contracts

### CPB response (future):

```json
{
  "fileId": "abc123",
  "analysisType": "cpb",
  "parameters": {
    "bandsPerOctave": 3,
    "weighting": "A"
  },
  "data": {
    "centerFrequenciesHz": [25, 31.5, 40, 50, 63, 80, 100],
    "levelsDb": [-45, -42, -38, -35, -30, -28, -25]
  }
}
```

### Finding (future):

```json
{
  "findingId": "finding_001",
  "fileId": "abc123",
  "type": "tonal_peak",
  "severity": "medium",
  "confidence": 0.91,
  "evidence": {
    "frequencyHz": 685,
    "prominenceDb": 11.2
  },
  "suggestedNextStep": "Compare against reference file or RPM/order data."
}
```

### Agent request (future):

```json
{
  "question": "Why does Product B sound sharper than Product A?",
  "selectedFiles": ["product_a.wav", "product_b.wav"],
  "evidence": {
    "basicMetrics": [],
    "soundQualityMetrics": [],
    "spectralFindings": [],
    "cpbComparison": []
  }
}
```

### Agent response (future):

```json
{
  "answer": "Product B appears sharper because...",
  "evidenceReferences": [
    { "type": "metric", "name": "sharpness", "file": "product_b.wav" },
    { "type": "cpb_difference", "frequencyRangeHz": "4000-8000" }
  ],
  "confidence": "medium",
  "limitations": "Based on available metrics only.",
  "suggestedNextStep": "Inspect CPB differences above 4 kHz."
}
```

---

# 16. Scrum Master Guidance

## Sprint Length

1-week sprints while the product is uncertain.

## Definition of Ready

A story is ready when it has:

- User persona
- User value
- Input/output expectations
- Acceptance criteria
- Edge cases
- Backend contract
- Frontend behavior
- Testing expectations
- Known assumptions

## Definition of Done

A story is done when:

- Feature works end-to-end
- Backend has tests for calculations/contracts
- Frontend handles loading/error/empty states
- Analysis values are reproducible
- Agent answers are grounded in real data
- No fake placeholder values remain
- User-facing labels are understandable
- Assumptions are documented

## Sprint Planning Rule

Always prefer a thin vertical slice.

Good vertical slice:

```
Import WAV → compute RMS/peak/clipping → display metrics → agent explains clipping result
```

Bad approach:

```
Build huge architecture for all future metrics before one full feature works.
```

## Backlog Prioritization (updated for current state)

1. ~~Reliable file import~~ ✅
2. ~~Basic metrics~~ ✅
3. ~~Spectrum/spectrogram~~ ✅
4. ~~A/B comparison~~ ✅
5. ~~Connect OpenAI API for agent explanations~~ ✅
6. ~~Findings panel~~ ✅
7. ~~Tonal peak detection~~ ✅
8. ~~CPB analysis~~ 🟡 Partial
9. ~~CPB comparison~~ ✅
10. ~~CPB weighting controls~~ ✅
11. ~~Standards-oriented CPB filter-bank mode via Python sidecar scaffold~~ 🟡
12. ~~Generated-WAV CPB sidecar validation tests~~ ✅
13. ~~Sound-quality metrics: loudness + sharpness + roughness~~ ✅ First slice done
14. ~~Sound-quality comparison~~ ✅
15. **Batch comparison / benchmarking** ← next

---

# 17. Coding Guidelines

When generating code:

- Prefer simple vertical slices
- Do not over-engineer too early
- Keep DSP logic separate from UI
- Keep OpenAI logic separate from DSP logic
- Keep Python sidecar isolated
- Do not hardcode fake metrics
- Do not fabricate AI findings
- Do not silently choose scientific formulas without documenting assumptions
- Add tests for calculation logic
- Add tests for data contracts
- Use clear names understandable to acoustic engineers
- Make analysis parameters explicit
- Handle errors clearly
- Avoid introducing large dependencies without explaining why
- Ask or add a TODO when a scientific choice is ambiguous

### Important Rule

If a calculation, standard, or algorithm is not clearly specified, do not pretend it is known.

Instead: add a clearly marked assumption, add a TODO, ask for confirmation, or implement a minimal clearly documented version.

```csharp
// TODO: Confirm whether CPB should follow IEC 61260 exact band definitions.
// Current implementation uses nominal 1/3-octave center frequencies.
```

### Project Conventions (observed)

- Backend uses FastEndpoints pattern (Command → Handler → Endpoint)
- Frontend uses feature-folder structure with Redux slices per feature
- API client in `src/shared/api/`
- SCSS modules for component styling
- Mantine components as the design system
- Canvas-based custom rendering for performance-critical visualizations

---

# 18. Agent Validation Rules

The agent must follow these rules:

1. It can only explain evidence provided by backend
2. It must not invent frequencies, levels, metrics, or causes
3. It must include uncertainty when needed
4. It must distinguish measured facts from hypotheses
5. It must suggest next steps based on evidence
6. It should be concise but useful
7. It should be understandable to non-experts when requested
8. It should be technical enough for engineers when requested

---

# 19. Innovation Direction

The product becomes disruptive when it moves beyond plotting.

Prioritize features that help users:

- Understand sound faster
- Compare many products
- Detect important differences
- Explain findings to others
- Generate evidence-based reports
- Decide what to test next

The future product should feel like:

> "An acoustic engineer sitting next to me, helping me investigate."

Not:

> "A chat box that guesses things about audio."

---

# 20. What I Want You To Do When I Ask For Help

When I ask for a feature, please respond with:

1. Brief product interpretation
2. User story
3. Acceptance criteria
4. Backend tasks
5. Frontend tasks
6. Data contracts
7. Tests

---

# 21. Immediate Recommended Sprint Goal

Sprint goal:

> Add sound-quality comparison evidence on top of the first loudness/sharpness/roughness metrics layer.

Suggested scope:

```
Use the implemented MoSQITo loudness/sharpness/roughness sidecar
→ run metrics for compared files or selected regions
→ return loudness/sharpness/roughness deltas with method metadata and limitations
→ surface deltas in the comparison UI
→ let agent compare/report artifacts cite only measured sound-quality evidence
→ keep calibration caveats explicit until physical SPL calibration exists
```

Findings, tonal peak detection, the first CPB graph slice, CPB comparison, CPB weighting controls, the experimental `python_filter_bank` sidecar path, generated-WAV CPB validation tests, the first MoSQITo loudness/sharpness/roughness slice, sound-quality comparison deltas, the full agent findings investigation flow (run_findings → findings_result + tool_result workspace artifacts, evidence citation pills, referenced context panel, markdown rendering), and Python package installation are all now implemented. The next high-value task is batch benchmarking, because it turns single-file and A/B workflows into product-family ranking, clustering, outlier detection, and report generation.

---

# 22. Product North Star

The long-term north star is:

> AcousticGPT helps engineers understand, compare, and improve sound faster by combining trustworthy DSP, batch benchmarking, and evidence-based AI investigation.

Every feature should support that direction.

---

*Use this file as the source of truth. Before implementing, check that the proposed solution follows the roadmap, architecture, and validation rules.*
