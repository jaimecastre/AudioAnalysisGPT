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

---

# 2. Current State of the Application (Last updated: 2026-06-09)

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

1. **Manual Analysis Mode** — Traditional signal inspection with file list, waveform, spectrum, spectrogram, comparison, and analysis inspector panels. Inspector starts collapsed by default.
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
| Batch benchmarking | ❌ Not started | — |
| Python sidecar | ✅ Active | `mosqito==1.2.1`, `PyOctaveBand==1.2.2` installed; executable path in `appsettings.Development.json` |

### Backend Analysis Details

**Level Analyzer:**
- Per-channel: min, max, peak, RMS, DC offset
- dB conversions with configurable reference
- Crest factor calculation
- Multi-channel averaging

**Spectrum Analyzer:**
- FFT size: configurable (default 8192)
- Window: Hann
- Overlap: 50%
- Scaling: one-sided amplitude, coherent-gain corrected
- Averaging: power-based
- Output: columnar arrays (FrequenciesHz[], Magnitudes[], MagnitudesDb[])

**Spectrogram Analyzer:**
- Adaptive frame capping (max 1000 frames)
- Frequency scales: linear, mel, log
- FFT: default 2048, overlap 75%
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
| Agent chat panel | ✅ Done | Messages, suggestion prompts, evidence tokens; markdown rendering via react-markdown; backend-agent responses use one in-place assistant bubble |
| Agent artifacts panel | ✅ Done | 9 artifact types: analysis, compare, find, findings_result, tool_result, markers, selections, views, reports |
| Agent tool execution loop | ✅ Done | Tool dispatch → API calls → artifact storage |
| Agent orchestrator workspace artifacts | ✅ Done | All 7 orchestrator tools produce deterministic workspace cards; badges collapsed until clicked |
| Agent orchestrator markdown responses | ✅ Done | Assistant answers rendered as markdown |
| Agent findings investigation | ✅ Done | "Detect findings and issues" suggestion chip → run_findings → FindingsCard with per-finding rows |
| File @mentions in chat | ✅ Done | Autocomplete dropdown |
| Mode switcher (Manual ↔ Agent) | ✅ Done | Segmented control in header |
| Resizable panels | ✅ Done | Drag handles, collapsible |
| Keyboard shortcuts | ✅ Done | Arrow seek, space play/pause |
| Report generation UI | 🟡 Partial | Artifact type exists, no renderer |
| Task progress panel | 🟡 Placeholder | Empty state only |
| Calibration UI | 🟡 Referenced in types | Not implemented |
| CPB / octave band visualization | ✅ Done | Collapsible CPB panel with octave / 1⁄3 octave modes |
| Sound quality metrics display | ✅ First slice done | Manual panel for MoSQITo stationary loudness + DIN sharpness |
| Batch comparison table | ❌ Not started | — |
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
| `chat` | messages[], isThinking |
| `agentWorkspace` | artifacts[], focusedArtifactId |
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
| `run_cpb` | Octave/1⁄3-octave band levels | `tool_result` |
| `run_sound_quality_metrics` | Loudness, sharpness, roughness | `tool_result` |
| `run_findings` | Full findings pipeline (clipping, silence, crest, DC offset, tonal peaks) | `findings_result` |

Routing: `questionRouter.ts` dispatches investigative keywords → orchestrator; workspace action keywords → old tool loop.

All orchestrator tool outputs are forwarded to the frontend via `ToolResultsData` in `AgentAskResult`. The frontend (`useAgentAsk`) creates workspace artifacts for every completed tool and appends evidence badge tokens to the chat message. Cards start collapsed and expand only when the user clicks the badge.

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

The strongest product direction is:

> **AI benchmark intelligence and acoustic investigation for product sound teams.**

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

## Principle 2 — Findings, Not Only Chat

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

## Principle 3 — Reproducibility

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

## Principle 4 — Batch Comparison Is a Key Differentiator

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

## Principle 5 — Keep the Product Narrow at First

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
- ✅ Agent artifacts panel (7 types)
- ✅ Tool services (analyze, compare, find, workspace, report)
- ✅ File @mentions in chat
- ✅ Evidence tokens in responses
- ✅ Backend `POST /api/analysis/run` produces LLM-ready summary
- ✅ OpenAI API connected via backend proxy (`POST /api/agent/chat`)
- ✅ Natural language explanation generation (gpt-4o-mini)
- ✅ Agent cites measured evidence in responses
- ✅ Agent suggests next analysis steps
- ✅ API key secured server-side (appsettings.Development.json, gitignored)

## 🟡 Milestone 2 — CPB and Sound Quality Layer — PARTIAL

Must-have features:

- ✅ CPB / octave / 1⁄3 octave graphs
- Loudness
- Sharpness
- Roughness (if feasible)
- Fluctuation strength (if feasible)
- A/B sound-quality comparison
- Metric ranking table across imported files
- Basic sound-quality summary

## 🟡 Milestone 3 — Evidence-Based Agent — IN PROGRESS

Must-have features:

- ✅ Agent orchestration vertical slice (planner → tools → evidence → grounded answer)
- ✅ `POST /api/agent/ask` endpoint
- ✅ `AgentOrchestrator`, `AgentPlanner`, `ToolExecutionService`, `EvidencePackageBuilder`, `AgentResponseValidator`
- ✅ AgentToolRegistry whitelist (get_metadata, run_basic_metrics, run_spectrum, run_cpb, run_sound_quality_metrics, run_event_detection, run_findings)
- ✅ Frontend: `useAgentAsk` hook, `agentAskSlice`, orchestrator workspace artifact dispatch
- ✅ Evidence references, confidence, limitations, suggested next steps in response
- ✅ `ToolResultsData` in `AgentAskResult` — all 7 tool outputs forwarded to frontend as structured data
- ✅ `findings_result` artifact type — per-finding cards (severity, type, time range, confidence, title, description)
- ✅ `tool_result` artifact type — labeled-metrics cards for all 6 non-findings tools
- ✅ Evidence badge chips in chat → expand workspace card on click (collapsed by default)
- ✅ Markdown rendering in assistant chat bubbles
- ✅ `run_findings` suggestion chip in agent chat
- ✅ Routing fix: `findings`/`issues` keywords route to orchestrator
- ✅ Agent can summarize findings with grounded evidence
- Agent can explain A/B differences
- Integrate fuller agent answer into investigation timeline (future)

## ❌ Milestone 4 — Batch Benchmarking — NOT STARTED

Must-have features:

- Import and analyze many files (10–100+)
- Batch metrics calculation
- Ranking table
- Outlier detection
- Reference vs candidate comparison
- Grouping/tagging files
- Batch findings
- Agent summary of batch results
- Export batch report

## ❌ Milestone 5 — Investigation Workspace — NOT STARTED

Long-term features:

- Project memory
- Investigation timeline
- AI-generated hypotheses
- Suggested next tests
- Reusable analysis cards
- Saved findings
- Report builder
- User feedback on AI findings
- Knowledge base / RAG for standards and previous cases

---

# 11. Suggested Next Priorities (after current state)

Given the current state, the recommended next work is:

1. ~~Connect OpenAI API~~ ✅ Done
2. ~~Findings Panel~~ ✅ Done — Structured findings from event detection + level analysis
3. ~~Tonal peak detection~~ ✅ Done — Local prominence heuristic in spectrum analyzer + findings
4. ~~CPB analysis~~ 🟡 Partial — Backend + manual CPB panel, comparison, Z/A/C weighting controls, experimental `python_filter_bank` sidecar path, and generated-WAV validation tests done; external calibrator validation pending
5. ~~Sound quality metrics: loudness + sharpness + roughness~~ ✅ First slice done — MoSQITo sidecar, backend endpoint, manual panel, direct metric imports, and generated-WAV validation
6. ~~Agent findings investigation flow~~ ✅ Done — `run_findings` wired into orchestrator; `findings_result` and `tool_result` workspace artifacts; evidence badges collapse until clicked; markdown rendering
7. ~~Python packages installed~~ ✅ Done — `mosqito==1.2.1`, `PyOctaveBand==1.2.2` installed in system Python 3.13; sidecar path configured
8. **Next: Sound-quality comparison** — Add loudness/sharpness/roughness deltas to A/B comparison UI and agent artifacts

---

# 12. Backlog Epics

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

---

# 13. Immediate User Stories

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
- ❌ Results can be compared between two files

## Story 7 — A/B Comparison ✅ DONE

## Story 8 — Evidence-Based Agent Explanation ✅ DONE

As a user, I want the agent to explain a selected analysis result so that I understand what the data means.

Acceptance criteria:

- ✅ Agent receives structured analysis JSON (via `ToolResultsData` in `AgentAskResult`)
- ✅ Agent cites measured evidence (grounded via `EvidencePackageBuilder`)
- ✅ Agent avoids unsupported claims (validated by `AgentResponseValidator`)
- ✅ Agent suggests one useful next step
- ✅ Agent states when evidence is insufficient (limitations field)
- ✅ Agent answer can be saved as artifact (workspace cards for all 7 tools)

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

# 14. API Contracts

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

# 15. Scrum Master Guidance

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
14. **Sound-quality comparison** ← next
15. Batch comparison

---

# 16. Coding Guidelines

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

# 17. Agent Validation Rules

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

# 18. Innovation Direction

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

# 19. What I Want You To Do When I Ask For Help

When I ask for a feature, please respond with:

1. Brief product interpretation
2. User story
3. Acceptance criteria
4. Backend tasks
5. Frontend tasks
6. Data contracts
7. Tests
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

# 20. Immediate Recommended Sprint Goal

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

Findings, tonal peak detection, the first CPB graph slice, CPB comparison, CPB weighting controls, the experimental `python_filter_bank` sidecar path, generated-WAV CPB validation tests, the first MoSQITo loudness/sharpness/roughness slice, the full agent findings investigation flow (run_findings → findings_result + tool_result workspace artifacts, evidence badge chips, markdown rendering), and Python package installation are all now implemented. The next high-value task is sound-quality comparison, because it turns isolated perceived metrics into benchmark evidence.

---

# 21. Product North Star

The long-term north star is:

> AcousticGPT helps engineers understand, compare, and improve sound faster by combining trustworthy DSP, batch benchmarking, and evidence-based AI investigation.

Every feature should support that direction.

---

*Use this file as the source of truth. Before implementing, check that the proposed solution follows the roadmap, architecture, and validation rules.*
