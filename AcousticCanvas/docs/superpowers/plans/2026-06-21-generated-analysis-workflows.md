# Generated Analysis Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Milestone 4.5 Phase 7 so Agent answers can show a deterministic workflow plan for broader acoustic investigations.

**Architecture:** The backend derives a trusted `workflow` response block from the existing visualization plan, evidence package, and tool plan/execution records. The frontend renders that block as a compact workflow card; it does not execute code or compute DSP.

**Tech Stack:** .NET 8 FastEndpoints backend, C# record contracts, React 19 + TypeScript 6 + Mantine frontend, xUnit and Vitest tests.

---

### Task 1: Backend Workflow Plan Tests

**Files:**
- Modify: `AcousticCanvas.Tests/ExpertVisualizationPlannerTests.cs`
- Modify: `AcousticCanvas.Tests/AgentResponseBlockSerializationTests.cs`

- [ ] Add a failing test that `ExpertVisualizationPlanner.Plan` emits a `workflow` block for broad multi-tool questions with at least three completed evidence types.
- [ ] Add a failing test that workflow blocks serialize with ordered steps and source tool names.
- [ ] Run targeted backend tests and confirm the new tests fail for missing `workflow`.

### Task 2: Backend Workflow Implementation

**Files:**
- Modify: `AcousticCanvas/Features/Agent/Orchestration/VisualizationBlockTypes.cs`
- Modify: `AcousticCanvas/Features/Agent/Orchestration/ExpertVisualizationPlanner.cs`
- Modify: `AcousticCanvas/Features/Agent/Orchestration/AgentResponseBlockModels.cs`
- Modify: `AcousticCanvas/Features/Agent/Orchestration/AgentVisualizationBlockBuilder.cs`
- Modify: `AcousticCanvas/Features/Agent/Orchestration/AgentOrchestrator.cs`

- [ ] Add `VisualizationBlockTypes.Workflow`.
- [ ] Add `WorkflowStep` and `WorkflowBlock` records.
- [ ] Add workflow planning for broad questions such as investigate, report, summarize, diagnose, compare, benchmark, why, and which when there are at least three completed tool-backed evidence items.
- [ ] Build workflow steps from evidence items using evidence type, result ID, file identity, and source tool.
- [ ] Append workflow blocks to `AgentAskResult.Blocks`.
- [ ] Run targeted backend tests and confirm they pass.

### Task 3: Frontend Workflow Rendering

**Files:**
- Modify: `AcousticCanvas.UI/src/features/agentAnalysis/services/agentAskService.ts`
- Create: `AcousticCanvas.UI/src/features/agentAnalysis/components/WorkflowBlockView.tsx`
- Modify: `AcousticCanvas.UI/src/features/agentAnalysis/components/AgentResponseBlockRenderer.tsx`
- Modify: `AcousticCanvas.UI/src/features/agentAnalysis/components/ChatPanel.tsx`

- [ ] Add `WorkflowBlock` and `WorkflowStep` TypeScript types.
- [ ] Render a compact Mantine workflow card with numbered steps, tool/evidence labels, file names, and result references.
- [ ] Add `workflow` to thought-container labels.
- [ ] Run frontend tests/build and fix type or render issues.

### Task 4: Documentation and Verification

**Files:**
- Modify: `PROJECT_CONTEXT.md`

- [ ] Add a dated note that Generated Analysis Workflows are implemented.
- [ ] Include tests run and any limitation.
- [ ] Run full backend tests, full UI tests, and UI build.
