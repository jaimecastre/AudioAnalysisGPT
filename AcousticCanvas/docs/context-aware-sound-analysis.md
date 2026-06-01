# Context-Aware Sound Analysis — Research & Design Document

**Status:** Draft — for review before implementation  
**Last updated:** June 2026  
**Relates to:** `audio_analysis_copilot_spec_and_roadmap.md`, AcousticCanvas v1 roadmap

---

## Overview

The core idea: **the same audio file should produce different analyses, different emphasis, and different recommendations depending on what the user is trying to achieve.**

A podcast editor does not need key detection. A machine monitoring engineer does not need filler-word timestamps. A bioacoustics researcher does not need EBU R128 loudness compliance. Right now AcousticCanvas runs the same deterministic DSP modules regardless of intent. This document proposes adding a *project context* layer that sits above the existing tool API and shapes what the agent prioritises, what it runs, and how it presents results.

This is not a replacement for the existing deterministic DSP backend. It is a goal-directed interpretation layer on top of it.

---

## 1. Use Cases and What Each Requires

Research sources: Auphonic singletrack algorithm docs, MixCheck Studio, mixanalytic.com, DCASE 2024 ASD task, BirdNET Cornell Lab, MDPI respiratory AI review, iZotope dialogue restoration blog, Essentia/librosa MIR documentation.

### 1.1 Podcast / Speech Recording

**User says:** *"I'm editing a podcast interview and want to know if it's ready to publish."*

**What matters (evidence-based, not subjective):**
- Integrated loudness vs platform targets: -16 LUFS (Apple Podcasts, Spotify), -14 LUFS (YouTube), -19 LUFS (Audible ACX). Source: Auphonic loudness normalization docs, EBU R128.
- True peak ceiling: -1 dBTP (Apple), -2 dBTP (Netflix).
- Clipping detection: any saturated samples.
- Long-duration silence: passages over 2s that are not intentional pauses (Auphonic silence cutter threshold).
- Noise floor: SNR below ~40 dB is audible. Background noise should be characterized (broadband, tonal, intermittent).
- Filler words ("um", "uh", "mh"): detectable via Whisper with `initial_prompt` trick or CrisperWhisper for verbatim transcription. Auphonic uses a dedicated classifier trained on 5+ years of podcast data.
- Room reverb / RT60 estimate: high reverb degrades intelligibility for earphone listeners.
- Breath and cough removal candidates: detectable as short-duration audio events with specific spectral shape.

**Analysis modules needed (existing + new):**
- ✅ Existing: `level` (peak, RMS, dBFS)
- ✅ Existing: `find clipping`, `find silence`
- 🆕 Needed: LUFS integrated / short-term / momentary measurement (EBU R128)
- 🆕 Needed: SNR estimation (noise floor characterisation)
- 🆕 Needed: Filler word detection (ASR-based)
- 🆕 Needed: RT60 / reverb estimation

**Output report keys:** loudness compliance, peak headroom, SNR, silence count, filler count + timestamps, reverb estimate, publish readiness verdict.

---

### 1.2 Music Mix / Master Review

**User says:** *"I'm mixing a track. Does the low end feel too heavy compared to a reference?"*

**What matters:**
- LUFS integrated and dynamic range (DR score, crest factor). Industry consensus per MixCheck Studio and mixanalytic.com: streaming-ready mix sits at -14 to -9 LUFS integrated, DR > 6.
- Tonal balance: per-band RMS ratios (sub 20–60 Hz, bass 60–250 Hz, low-mid 250–500 Hz, presence 1–4 kHz, air 8–16 kHz). MixAnalytic uses 13 frequency bands.
- Stereo image: M/S balance, phase correlation. Mono compatibility (correlation < 0 is a problem).
- Transient density: crest factor per section as proxy for "punchiness".
- Clipping and intersample peaks.
- Reference track comparison: same metrics on a reference file, pairwise delta (existing `compare` tool extended with band energy).
- Key and tempo (MIR): librosa `beat_track` / Essentia `KeyExtractor`. Useful for remix workflow.

**Analysis modules needed:**
- ✅ Existing: `level`, `spectrum`, `compare`, `find clipping`, `find loudest`
- 🆕 Needed: Band-energy analysis (configurable frequency bands)
- 🆕 Needed: LUFS + DR measurement
- 🆕 Needed: Stereo correlation / M-S analysis
- 🆕 Needed: Key + tempo (MIR, Phase 7+ roadmap item)

**Output report keys:** integrated LUFS, peak headroom, DR score, band balance chart, stereo correlation, reference delta per band, key/tempo, masking risks.

---

### 1.3 Machine / Industrial Condition Monitoring

**User says:** *"I'm monitoring a factory pump. Does this recording sound different from the baseline?"*

**What matters (DCASE 2024 ASD Task research):**
- Anomaly detection vs a known-good baseline: unsupervised autoencoder reconstruction error or Mahalanobis distance (DCASE 2022/2024 winning approach). The DCASE 2024 Task 2 baseline uses a simple autoencoder + selective Mahalanobis. Key finding: **the model must be trained on normal operation audio from that specific machine**, not generic audio.
- Recurring spectral patterns: bearing defects appear as sidebands around harmonics of shaft rotation frequency. Envelope analysis (Hilbert transform) reveals modulation. Source: NI acoustic monitoring overview.
- RMS trend over time: gradual rise indicates wear. Sudden spike indicates acute fault.
- Specific frequency anomalies: looseness → sub-harmonics; imbalance → 1× RPM; cavitation → broadband 1–10 kHz rise.
- Comparison to a stored baseline recording is essential: without it, you cannot distinguish "abnormal" from "this machine is just loud."

**Analysis modules needed:**
- ✅ Existing: `level`, `spectrum`, `find transient`, `compare`
- 🆕 Needed: Spectral centroid trend over time
- 🆕 Needed: Autoencoder-based anomaly score (requires a baseline recording per machine)
- 🆕 Needed: Envelope spectrum (for bearing/gear diagnosis)

**Key design constraint:** This use case **requires a stored baseline**. The UX must guide the user to record or upload a "normal" reference before anomaly scoring means anything.

---

### 1.4 Sound Dataset / ML Annotation

**User says:** *"I'm building a training dataset for a sound classifier."*

**What matters (DCASE annotation format research):**
- Event onset and offset timestamps with class label (DCASE strong label format: `onset\toffset\tevent_label`).
- Confidence scores per detection.
- Overlapping sound detection (polyphonic events).
- False-positive risk: signal-to-noise in the detected region, proximity to other events.
- Dataset quality: class balance preview, event duration statistics, SNR per event.
- Export formats: CSV/TSV (DCASE format), JSON, Audacity label file format.

**Analysis modules needed:**
- ✅ Existing: `find transient`, `find silence` (for segmentation boundaries)
- 🆕 Needed: PANNs-based audio tagging (527-class AudioSet classifier) for auto-labelling candidates. Source: Kong et al. 2019, PANNs paper, mAP 0.439 on AudioSet.
- 🆕 Needed: Overlap detection (energy-based polyphony estimate)
- 🆕 Needed: Export to DCASE TSV / Audacity labels

---

### 1.5 Bioacoustics / Wildlife Recording

**User says:** *"I recorded birds in a forest this morning. What species are present and when?"*

**What matters (BirdNET research, Cornell Lab):**
- Species detection with timestamps and confidence scores. BirdNET identifies 984 North American bird species from 3-second audio chunks. It outputs `start_time, end_time, species, confidence`. Source: BirdNET paper, Ecological Informatics 2021.
- Environmental noise characterisation: rain, wind, traffic, human voice all degrade detection confidence. Should be flagged alongside species detections.
- Activity summary over long recordings: species count per time period, dominant species, silence ratio.
- Confidence threshold: BirdNET recommends 0.1–0.5 depending on environment. Low-confidence detections should be surfaced as "review candidates" not facts.
- Long-duration support: 1–8 hour recordings are common. Chunked analysis with activity timeline is required.

**Analysis modules needed:**
- ✅ Existing: `find silence` (for segmentation), `find loudest` (peak activity windows)
- 🆕 Needed: BirdNET integration (open-source, Apache 2.0) or PANNs for general environmental tagging
- 🆕 Needed: Chunked long-file analysis (windowed processing with configurable step)
- 🆕 Needed: Activity timeline output (events per time window)

---

### 1.6 Film / TV Dialogue Editing

**User says:** *"I'm cleaning dialogue for a film scene. Help me find problems."*

**What matters (iZotope restoration blog, LinkedIn dialogue clarity guidance):**
- Room tone consistency: abrupt noise floor changes between cuts indicate edit discontinuities. Measurable as short-term RMS variance at scene boundaries.
- Mouth clicks and plosives: transient artifacts with specific low-frequency spectral shape (~80–200 Hz burst). Detectable with existing transient finder + frequency gating.
- Background noise characterisation: is it broadband (traffic, HVAC) or tonal (hum at 50/60 Hz)?
- Speech intelligibility proxy: high-frequency energy ratio (presence band 1–4 kHz vs total), reverb estimate, SNR.
- Edit cut points: silence gaps < 50ms between speech segments that may need room-tone fill.
- Level inconsistency between characters: RMS variance across manually segmented speaker turns.

**Analysis modules needed:**
- ✅ Existing: `level`, `find silence`, `find transient`, `find clipping`
- 🆕 Needed: Short-term RMS timeline (for noise floor consistency)
- 🆕 Needed: Plosive / mouth-click detector (specific spectral shape filter on top of transient finder)
- 🆕 Needed: Hum/tonal noise detector (narrow-band energy spike at 50/60 Hz harmonics)

---

### 1.7 Health-Related Sound (Cough, Breathing, Snoring)

**User says:** *"I recorded my own breathing while sleeping. Can you tell me anything about it?"*

**What matters — and what must be avoided (MDPI AI respiratory health review, MIT Technology Review):**
- Pattern detection: event count, rate, irregularity. These are measurable facts.
- Confidence scores on detections must be visible. The MDPI review shows AI cough classifiers achieve 85–95% sensitivity in controlled conditions, but much lower in real-world recordings with background noise.
- **Hard constraint:** No diagnostic, medical, or clinical claims. The MDPI review and MIT Tech Review are explicit: apps like Hyfe.ai and Sonde Health use specific clinical validation pipelines and regulatory pathways. Unvalidated tools must not say "this sounds like sleep apnea."
- Output must include a prominent disclaimer: *"This tool detects audio patterns only. It does not diagnose medical conditions. Consult a healthcare professional."*
- Detected events should be described as "irregular breathing pattern detected" not "possible apnea."

**Analysis modules needed:**
- 🆕 Needed: Respiratory event detector (cough, breath, snore pattern classification)
- 🆕 Needed: Pattern rate and regularity metrics
- **Required gate:** disclaimer must appear before any results are shown. The disclaimer cannot be bypassed.

---

## 2. The Context Layer — Architecture Proposal

### 2.1 Core Concept: Analysis Profile

An **Analysis Profile** is a named configuration that:
1. Maps a user intent to a prioritised list of analysis modules.
2. Defines which findings are "important" vs "informational" for that goal.
3. Carries a system prompt extension that shapes LLM interpretation.
4. Optionally requires specific questions to be answered before running.

```typescript
type AnalysisProfile = {
  id: string;                          // e.g. "podcast", "music_mix", "machine_monitoring"
  label: string;                       // shown in UI
  description: string;                 // one-line explanation
  requiredModules: string[];           // always run these
  optionalModules: string[];           // run if available / user confirms
  priorityFindings: string[];          // surface these prominently
  systemPromptExtension: string;       // injected into LLM system prompt
  requiresBaseline: boolean;           // needs a reference file
  preRunQuestions: PreRunQuestion[];   // clarifying questions before analysis
  outputSections: OutputSection[];     // ordered report sections
  disclaimer?: string;                 // required for health/legal contexts
};

type PreRunQuestion = {
  id: string;
  question: string;
  inputType: 'text' | 'select' | 'boolean';
  options?: string[];
  storesAs: string;                    // key in session context
};

type OutputSection = {
  id: string;
  title: string;
  moduleSource: string;               // which analysis module populates this
  importance: 'critical' | 'important' | 'informational';
};
```

### 2.2 Session Context

The session context accumulates everything the agent knows about the current goal:

```typescript
type SessionContext = {
  profileId: string | null;
  userGoalText: string;               // raw user input, e.g. "I'm editing a podcast"
  answers: Record<string, unknown>;   // answers to pre-run questions
  baselineFileId: string | null;      // for machine monitoring, bioacoustics comparison
  targetPlatform: string | null;      // e.g. "spotify", "netflix", "youtube"
  notes: string;                      // freeform user notes accumulated in session
};
```

This is stored in Redux alongside the project state. It is sent to the LLM as structured context on every turn.

### 2.3 Intent Detection Flow

```
User message
     │
     ▼
LLM classifies intent (system prompt + few-shot examples)
     │
     ├── Profile identified → load AnalysisProfile
     │       │
     │       ├── Has preRunQuestions? → ask them (Follow-up pattern)
     │       │
     │       └── Run prioritised modules → interpret with profile systemPromptExtension
     │
     └── Profile ambiguous / "vague goal" → ask one clarifying question:
             "What are you trying to achieve with this audio?"
             (ShapeofAI Follow-up pattern: ask ONCE, don't interrogate)
```

The LLM should **attempt something useful immediately** even before full profile resolution, then refine. Do not gate all analysis behind clarification — this frustrates users who want fast answers.

### 2.4 Modular Backend Pipeline

The backend pipeline should be separated into discrete stages, each independently testable:

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Audio Ingestion          Upload / live capture / URL         │
│  2. Preprocessing            Resampling, channel mixing, trim    │
│  3. Feature Extraction       DSP: RMS, FFT, LUFS, spectral feats │
│  4. AI Inference             BirdNET, PANNs, Whisper, ASD model  │
│  5. Context Interpretation   LLM: profile-aware finding ranking  │
│  6. Recommendation Engine    Rule-based + LLM suggestions        │
│  7. Report Generation        Profile-specific output sections    │
│  8. Export                   JSON, CSV, Markdown, DCASE TSV      │
└─────────────────────────────────────────────────────────────────┘
```

Stages 1–4 are pure functions: deterministic, no LLM, independently testable.  
Stages 5–7 are LLM-assisted: same DSP data, different interpretation depending on profile.  
Stage 8 is format rendering only.

This aligns with the existing project principle: *"DSP backend is evidence — all technical claims must come from deterministic analysis outputs."*

---

## 3. Data Model Extensions

### 3.1 Extended AnalysisResult (backend C#)

The existing `AnalysisResult` record stores file info + level + spectrum. New profile-aware results would extend it:

```csharp
public sealed record ContextualAnalysisResult
{
    public required string ProfileId { get; init; }
    public required string FileId { get; init; }
    public required SessionContext SessionContext { get; init; }
    public required IReadOnlyList<AnalysisFinding> Findings { get; init; }
    public required IReadOnlyList<Recommendation> Recommendations { get; init; }
    public required IReadOnlyList<AudioEvent> Events { get; init; }
    public required DateTimeOffset RanAt { get; init; }
    public string? Disclaimer { get; init; }
}

public sealed record AnalysisFinding
{
    public required string Id { get; init; }
    public required string Category { get; init; }      // e.g. "loudness", "noise_floor"
    public required string Label { get; init; }          // human-readable
    public required double Value { get; init; }
    public required string Unit { get; init; }
    public required string Importance { get; init; }    // "critical" | "important" | "info"
    public double? Threshold { get; init; }
    public bool? PassesThreshold { get; init; }
    public double? Confidence { get; init; }            // null for deterministic DSP
}

public sealed record Recommendation
{
    public required string Id { get; init; }
    public required string Text { get; init; }
    public required string Category { get; init; }
    public string? PluginSuggestion { get; init; }      // e.g. "iZotope RX De-click"
    public string? DawActionHint { get; init; }         // e.g. "Insert on dialogue track"
}
```

### 3.2 Export Formats

| Format | Use case | Content |
|---|---|---|
| Markdown report | All | Summary, findings table, recommendations, timestamps |
| JSON | All / programmatic | Full structured result tree |
| DCASE TSV | Dataset annotation | `onset\toffset\tlabel\tconfidence` per event |
| Audacity labels | Dataset annotation | `start\tend\tlabel` |
| CSV | Machine monitoring | Timestamp, metric, value, threshold, status |
| Plain-language summary | Non-technical users | Paragraph prose, no jargon |

---

## 4. Example JSON Output Schema

```json
{
  "profileId": "podcast",
  "fileId": "interview_ep42.wav",
  "ranAt": "2026-06-01T14:00:00Z",
  "findings": [
    {
      "id": "loudness_integrated",
      "category": "loudness",
      "label": "Integrated loudness",
      "value": -18.4,
      "unit": "LUFS",
      "importance": "critical",
      "threshold": -16.0,
      "passesThreshold": false,
      "confidence": null
    },
    {
      "id": "true_peak",
      "category": "loudness",
      "label": "True peak",
      "value": -1.8,
      "unit": "dBTP",
      "importance": "critical",
      "threshold": -1.0,
      "passesThreshold": true,
      "confidence": null
    },
    {
      "id": "noise_floor",
      "category": "noise",
      "label": "Estimated noise floor",
      "value": -62.3,
      "unit": "dBFS",
      "importance": "important",
      "confidence": null
    },
    {
      "id": "filler_count",
      "category": "speech",
      "label": "Filler words detected",
      "value": 14,
      "unit": "count",
      "importance": "informational",
      "confidence": 0.87
    }
  ],
  "events": [
    {
      "kind": "silence",
      "startSeconds": 12.4,
      "endSeconds": 15.1,
      "durationSeconds": 2.7,
      "description": "Long silence gap — may need room tone fill",
      "metadata": {}
    },
    {
      "kind": "filler",
      "startSeconds": 34.2,
      "endSeconds": 34.6,
      "durationSeconds": 0.4,
      "description": "Filler word: 'um'",
      "metadata": { "word": "um", "confidence": 0.91 }
    }
  ],
  "recommendations": [
    {
      "id": "rec_loudness",
      "text": "Apply +2.4 dB gain to reach -16 LUFS target for Spotify/Apple Podcasts.",
      "category": "loudness",
      "pluginSuggestion": "Auphonic or Adobe Podcast Enhance",
      "dawActionHint": "Master bus gain or loudness normalizer"
    },
    {
      "id": "rec_fillers",
      "text": "14 filler words detected. Review timestamps for manual or automatic removal.",
      "category": "speech",
      "pluginSuggestion": "Auphonic filler cutter or Descript",
      "dawActionHint": null
    }
  ],
  "disclaimer": null
}
```

---

## 5. LLM System Prompt Extension — Per Profile

The existing system prompt tells the agent what tools exist. The profile extension tells it how to interpret results for the current goal.

**Podcast profile extension:**
```
The user is editing a podcast. When analysing audio:
- Report integrated loudness first. Target: -16 LUFS (Spotify/Apple). Flag if outside -18 to -14 LUFS range.
- Report true peak. Flag anything above -1 dBTP.
- Report noise floor. Flag if SNR is below 40 dB.
- Count and timestamp filler words if detected.
- Silence gaps above 2 seconds are likely edit opportunities, not intentional pauses.
- Do not report key, tempo, or stereo width — these are not relevant for podcast.
- Frame recommendations in terms of publish readiness.
```

**Machine monitoring profile extension:**
```
The user is monitoring industrial equipment. When analysing audio:
- Compare to baseline recording if provided. Report reconstruction error or spectral delta.
- Flag any sudden RMS increase above +6 dB vs baseline.
- Report dominant spectral peaks and whether they match known fault frequencies if the user has provided RPM or machine type.
- Do not comment on perceptual quality, loudness normalisation, or speech intelligibility.
- Frame all findings as condition indicators, not diagnoses.
```

**Health-related profile extension:**
```
The user has submitted a health-related sound recording.
IMPORTANT: You are an audio pattern detection tool, not a medical diagnostic system.
- You may report: event count, rate, duration, regularity, and spectral characteristics.
- You must NOT say or imply any medical condition, diagnosis, or health status.
- Begin every response in this profile with the disclaimer: "This analysis detects audio patterns only and does not constitute medical advice."
- If the user asks for a medical interpretation, decline and recommend a qualified professional.
```

---

## 6. UX Flow — Profile Selection

Based on ShapeofAI Open Input + Follow-up + Nudges patterns:

### 6.1 Natural language → profile (primary path)

The user types freely. The LLM extracts profile from intent. No forced form.

> *"I'm editing a podcast interview"* → maps to `podcast`  
> *"Checking a mix before mastering"* → maps to `music_mix`  
> *"Monitoring a pump bearing"* → maps to `machine_monitoring`  

If ambiguous (e.g. *"I want to check the audio quality"*), the agent asks **one** focused question:

> *"What's the goal for this audio — podcast, music mix, field recording, machine monitoring, or something else?"*

It does not ask multiple questions. It picks the most likely profile and proceeds, then offers to switch.

### 6.2 Context-aware suggestion chips (empty state)

When a file is loaded and no profile is set yet, the empty-state chips should be context-sensitive:

```
If file loaded:
  "Podcast or speech recording?"
  "Music mix ready for mastering?"
  "Wildlife / field recording?"
  "Technical / industrial monitoring?"

If no file loaded:
  "Load an audio file to get started"
```

### 6.3 Profile badge in chat header

Once a profile is set, show a small persistent badge (e.g. `🎙 Podcast mode`) in the agent header. Clicking it allows switching profile without clearing the conversation.

### 6.4 Pre-run questions (only when necessary)

Some profiles require information before running:
- Machine monitoring: *"Do you have a baseline recording to compare against?"*
- Music mix: *"Which platform are you targeting? (Spotify, Apple Music, YouTube, other)"*
- Bioacoustics: *"Approximate recording location? (for species filtering)"*

These are shown as a compact question card in the chat, not a modal. The user can skip — the agent falls back to generic defaults.

---

## 7. Safety and Privacy Requirements

### 7.1 Live audio / microphone capture
- Requires explicit user consent prompt before activating.
- No audio data sent to external servers without explicit opt-in.
- Buffer is discarded after analysis unless user explicitly saves.
- Visual recording indicator must be always visible.

### 7.2 Health-related audio
- Hard disclaimer gate before any output.
- No diagnostic language permitted in any output string, system prompt, or recommendation.
- Results must use hedged language: "pattern detected" not "condition identified."
- Do not store health-related audio on server by default (session-only, in-browser processing preferred).
- Flag this use case for additional legal review before shipping.

### 7.3 Security / forensic audio
- If user asks about voice authentication, speaker identification, or evidence analysis: disclose that the system does not produce forensically validated output.
- Do not make identity claims from voice.

### 7.4 General data handling
- Uploaded files stored in `AudioStorage/` with no PII in filename (existing UUID-based naming is correct).
- FileId paths are already sanitised before sending to LLM (existing `sanitizeResultForLlm` function in `toolExecutor.ts`).
- Analysis results do not include raw audio samples, only derived metrics.

---

## 8. AI Model Options by Use Case

| Use case | Model / Library | Licence | Inference location |
|---|---|---|---|
| Podcast loudness | EBU R128 algorithm (libebur128) | BSD | Backend (C#/native) |
| Filler words | Whisper + `initial_prompt` trick, or CrisperWhisper | MIT / Apache 2.0 | Backend (Python sidecar) |
| Music MIR (key, tempo) | librosa / Essentia | ISC / AGPL | Backend (Python sidecar) |
| General audio tagging | PANNs (CNN14, mAP 0.439 on AudioSet) | MIT | Backend (Python sidecar) |
| Bird species | BirdNET (Cornell Lab) | Apache 2.0 | Backend (Python sidecar) |
| Machine anomaly detection | DCASE autoencoder baseline | MIT | Backend (Python sidecar) |
| Speech transcription | Whisper (openai-whisper) | MIT | Backend (Python sidecar) |
| Noise floor / SNR | DSP (existing FFT infrastructure) | — | Backend (C#) |

Note: The current backend is C# (.NET 8, FastEndpoints). ML inference models in Python can be exposed as a **sidecar microservice** (FastAPI, port 5001) called from the C# backend. This avoids rewriting the existing DSP infrastructure and lets the Python ML ecosystem be used without constraints.

---

## 9. Existing Components That Support This

| Component | File | Supports |
|---|---|---|
| Tool API | `capabilitiesRegistry.ts` | Profile-specific capability filtering |
| Agent tool runner | `agentToolRunner.ts` | Profile extension injection into `runLlmToolLoop` |
| `analyze` tool | `analyzeToolService.ts` | New analysis kinds per profile |
| `find` tool | `FindEventsHandler.cs` | Extended event kinds (filler, plosive, etc.) |
| `compare` tool | `RunCompareHandler.cs` | Baseline comparison for monitoring |
| `report` tool | (planned) | Profile-specific report sections |
| Chat input | `useChatInput.ts` | Profile detection from initial message |
| Redux state | `projectSlice.ts` | Add `sessionContext: SessionContext` field |
| Workspace slice | `agentWorkspaceSlice.ts` | Add profile artifact type |

---

## 10. New Modules Required

### Backend (C#)
- `Features/Context/Domain/AnalysisProfile.cs` — profile definition records
- `Features/Context/Domain/SessionContext.cs` — session context record
- `Features/Context/Commands/SetSessionContextCommand.cs`
- `Features/Context/Handlers/SetSessionContextHandler.cs`
- `Features/Analysis/Analyzers/LufsAnalyzer.cs` — EBU R128 LUFS + true peak
- `Features/Analysis/Analyzers/NoiseFloorAnalyzer.cs` — SNR estimation
- `Features/Analysis/Analyzers/ShortTermRmsTimelineAnalyzer.cs` — for film dialogue consistency

### Python sidecar (new service, `AcousticCanvas.ML/`)
- `main.py` — FastAPI app
- `models/panns_inference.py` — PANNs audio tagging
- `models/birdnet_inference.py` — BirdNET species detection
- `models/whisper_inference.py` — filler word / transcription
- `models/asd_baseline.py` — anomaly detection autoencoder

### Frontend (TypeScript/React)
- `features/context/contextSlice.ts` — Redux slice for `SessionContext`
- `features/context/profileRegistry.ts` — frontend copy of profile definitions
- `features/agentAnalysis/ProfileBadge.tsx` — profile indicator in agent header
- `features/agentAnalysis/PreRunQuestionCard.tsx` — inline question UI
- Extend `EmptyState` in `ChatPanel.tsx` with context-aware chips

---

## 11. Phased Implementation Plan

### MVP — Context-aware LLM interpretation (no new DSP modules)

**What:** Add `SessionContext` to Redux. Detect profile from user's first message. Inject profile-specific system prompt extension into existing `runLlmToolLoop`. Show profile badge in header.

**Value:** The agent immediately interprets the same analysis results differently for a podcast vs a music mix. No new backend work required.

**Effort:** ~2 days frontend, ~0.5 days backend (system prompt extension only).

**Files changed:**
- `agentToolRunner.ts` — inject profile extension
- `projectSlice.ts` or new `contextSlice.ts` — store `SessionContext`
- `ChatPanel.tsx` — profile badge
- `capabilitiesRegistry.ts` — profile-aware capability descriptions

---

### v1 — New DSP modules for top 2 use cases (Podcast + Music)

**What:**
- LUFS + true peak measurement (C# backend, libebur128 or custom ITU-R BS.1770 implementation)
- Band-energy analysis (C# backend, 13 configurable bands)
- Stereo M/S correlation (C# backend, extend existing `compare` tool)
- Context-aware suggestion chips in empty state
- Profile selection UI (natural language + quick-pick)

**Value:** Podcast and music mixing users get substantially more useful output.

**Effort:** ~1 week backend (DSP), ~3 days frontend.

---

### v2 — Python ML sidecar + dataset annotation

**What:**
- FastAPI sidecar service with PANNs (general tagging) and Whisper (filler words, transcription)
- DCASE TSV and Audacity label export
- Baseline comparison for machine monitoring (autoencoder, requires baseline upload flow)
- Pre-run question cards in UI
- Extended `find` tool kinds: `filler_word`, `plosive`, `noise_burst`

**Value:** Dataset annotation, machine monitoring, and dialogue editing use cases become viable.

**Effort:** ~2 weeks (ML sidecar setup is the main risk — model download, inference latency, containerisation).

---

### v3 — CPB filters, 1/3 octave analysis, and sound quality metrics

**What:**

**CPB (Constant Percentage Bandwidth) analysis** — the industry-standard way to look at spectrum in acoustic engineering, NVH, and product sound design:
- 1/3 octave band analysis: 31 ISO 266 standard bands from 20 Hz to 20 kHz, IEC 61260-1 compliant
- 1/1 octave analysis: 10 bands, same standard
- Output: RMS energy in dBFS (or dB SPL if a calibration factor is provided) per band
- Difference from the current FFT spectrum: CPB uses logarithmically spaced, perceptually scaled bands that match how the human ear processes frequency. The current FFT gives raw linear-spaced bins — useful for finding exact frequencies, not for acoustic measurement reporting.
- Implementation: a bank of IIR Butterworth bandpass filters in C#, one per ISO centre frequency. Alternatively: FFT energy summed per ISO band (faster, accurate enough for most uses). Standard: IEC 61260-1:2014 / ANSI S1.11.
- Fits as new `analyze()` kinds: `cpb_third_octave`, `cpb_octave` — no new agent tools needed.

**Psychoacoustic / sound quality metrics** — quantify how sound is *perceived*, not just what's physically present:

| Metric | Standard | Unit | What it tells you |
|---|---|---|---|
| Loudness | ISO 532-1 (Zwicker) / ISO 532-2 (Moore-Glasberg) | Sone / Phon | Perceived loudness, accounting for masking and equal-loudness contours |
| Sharpness | DIN 45692 | Acum | High-frequency harshness — "grating" or "cutting" character |
| Roughness | Aures model | Asper | Fast AM modulation (~15–300 Hz) — "growling" or "harsh" character |
| Fluctuation strength | Fastl & Zwicker | Vacil | Slow AM modulation (~0.5–20 Hz) — tremolo, warble |
| Tonality | ECMA-418-2 | — | Presence of tonal components (whines, hums) vs broadband noise |
| Speech Transmission Index | IEC 60268-16 | STI (0–1) | How well speech is intelligible in a given acoustic environment |

**Who needs these:**
- Automotive / product NVH engineers: "does this fan sound cheap?"
- HVAC / building acoustics: noise assessment, room acoustic quality
- Machine monitoring (extends v2): not just "is something different" but "does it sound rough / tonal?"
- Podcast / dialogue: STI for room intelligibility measurement
- Sound designers: designing product sounds with intentional perceptual character

**Implementation path:**
- CPB: pure C# IIR filter bank, self-contained, ~1 week
- Sound quality metrics (Zwicker loudness etc.): complex DSP — recommended to implement via **Python sidecar** using `mosqito` (open source, MIT licence) or `python-acoustics`. `mosqito` implements Zwicker loudness, sharpness, roughness, fluctuation strength, and tonality to ISO/DIN standards.
- New `analyze()` kinds: `loudness_zwicker`, `sharpness`, `roughness`, `tonality`
- New card types in `AgentWorkspacePanel`: CPB bar chart (31 bars, log x-axis), sound quality metrics summary card

**Profiles that benefit most:** music mix, machine monitoring, film dialogue, product sound design (new profile)

**Effort:** CPB alone ~1 week backend + 2 days frontend. Full psychoacoustic suite ~2–3 weeks (Python sidecar dependency).

---

### Advanced — BirdNET, health audio, live capture

**What:**
- BirdNET integration for bioacoustics (Apache 2.0, can be self-hosted)
- Health audio profile with hard disclaimer gate (requires legal review first)
- Activity timeline UI for long-duration recordings
- Live microphone capture (browser MediaRecorder API → backend stream)

**Risks:**
- Health audio: legal and regulatory complexity. Do not ship without legal review.
- Live capture: latency, browser permission UX, privacy policy update required.
- BirdNET model size: ~100 MB. Needs caching strategy.

**Effort:** ~3 weeks.

---

## 12. Open Questions

1. **Where does the ML sidecar live?** Same host as C# backend (Docker Compose), or separate deployment? This affects latency and infrastructure cost.
2. **Profile stored where?** In the project file (persists across sessions) or session-only (lost on reload)? The spec says the project state should persist.
3. **Who defines profiles?** Should users be able to create custom profiles, or is the set fixed? Custom profiles require a profile editor UI.
4. **Reference / baseline file UX:** How does a user designate one of their loaded files as the "baseline" for machine monitoring? Needs a new workspace concept beyond the current single active-file model.
5. **LUFS implementation:** libebur128 is C, not directly available in .NET. Options: P/Invoke wrapper, WebAssembly port, or pure C# implementation of BS.1770. All are feasible but each has a different maintenance cost.
6. **Long-file processing:** Files > 30 minutes need chunked streaming analysis. The current `float[] samples` in-memory model will not scale. This needs to be addressed before bioacoustics or machine monitoring use cases ship.
7. **Health audio legal review:** Who is responsible for ensuring the disclaimer is always shown and that no clinical language ever appears in output? This needs a process, not just a code comment.

---

*Document written June 2026. Research sources: Auphonic algorithm documentation; MixCheck Studio / mixanalytic.com; DCASE 2022/2024 ASD Task documentation; BirdNET Cornell Lab paper (Ecological Informatics 2021); PANNs paper (Kong et al. 2019); MDPI AI respiratory health review 2024; iZotope audio restoration blog; NI acoustic monitoring overview; ShapeofAI Follow-up and Open Input patterns; UXTigers intent-based UX research.*
