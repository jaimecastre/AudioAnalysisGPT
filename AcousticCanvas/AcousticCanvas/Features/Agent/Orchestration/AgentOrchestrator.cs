using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Services;
using AcousticCanvas.Features.AudioUpload.Services;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentOrchestrator(
    AgentPlanner agentPlanner,
    ToolExecutionService toolExecutionService,
    AudioFileRepository audioFileRepository,
    IInvestigationTraceStore investigationTraceStore
)
{
    public async Task<AgentAskResult> HandleUserQuestionAsync(
        AgentAskCommand command,
        CancellationToken cancellationToken
    )
    {
        var conversationId = "conv_" + Guid.NewGuid().ToString("N")[..8];

        var metaAnswer = AgentMetaQuestionRouter.TryAnswer(command.Question);
        if (metaAnswer is not null)
        {
            var metaInvestigationTrace = AgentResultBuilder.BuildInvestigationTrace(
                conversationId,
                command.Question,
                InvestigationPath.MetaQuestion,
                [],
                [],
                metaAnswer,
                "high"
            );

            investigationTraceStore.Store(metaInvestigationTrace);

            return AgentResultBuilder.BuildNoToolConversationResult(
                conversationId,
                metaAnswer,
                metaInvestigationTrace
            );
        }

        // Check if no files are loaded and the question appears to be about audio analysis
        if (
            command.SelectedFileIds.Count == 0
            && AppearsToBeAudioAnalysisQuestion(command.Question)
        )
        {
            var answer =
                "No audio files are currently loaded. Please upload and select an audio file first, then ask your question about that file.";
            var noFilesInvestigationTrace = AgentResultBuilder.BuildInvestigationTrace(
                conversationId,
                command.Question,
                InvestigationPath.NoFiles,
                [],
                [],
                answer,
                "low"
            );

            investigationTraceStore.Store(noFilesInvestigationTrace);

            return AgentResultBuilder.BuildNoToolConversationResult(
                conversationId,
                answer,
                noFilesInvestigationTrace
            );
        }

        // Step 0: Answer plain deterministic-fact questions (peak/RMS/sample rate/etc.)
        // straight from the backend tools, without calling the LLM. This keeps factual
        // lookups fast and working even when no OpenAI key is configured.
        var deterministicPlan = DeterministicFactRouter.TryRoute(command.Question);
        if (deterministicPlan is not null && command.SelectedFileIds.Count > 0)
        {
            return await AnswerDeterministicFactAsync(
                conversationId,
                command,
                deterministicPlan,
                cancellationToken
            );
        }

        var deterministicVisualPlan = DeterministicVisualRouter.TryRoute(command.Question);
        if (deterministicVisualPlan is not null && command.SelectedFileIds.Count > 0)
        {
            return await AnswerDeterministicVisualRequestAsync(
                conversationId,
                command,
                deterministicVisualPlan,
                cancellationToken
            );
        }

        // Step 1: Resolve file names for the selected file IDs.
        var selectedFileNames = ResolveFileNames(command.SelectedFileIds);

        // Step 2: Ask the planner what tools are needed.
        var plannerResponse = await agentPlanner.PlanRequiredToolsAsync(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            command.ConversationContext,
            cancellationToken,
            command.ModelOverride
        );

        // Step 3: Handle non-tool actions.
        if (plannerResponse.Action == "ask_clarification")
        {
            return AgentResultBuilder.BuildClarificationResult(
                conversationId,
                plannerResponse.ClarificationQuestion ?? "Could you provide more context?"
            );
        }

        if (plannerResponse.Action == "no_analysis_needed")
        {
            return AgentResultBuilder.BuildNoAnalysisResult(
                conversationId,
                command.Question,
                plannerResponse.Reason ?? "No analysis was required for this question."
            );
        }

        // Step 4: Validate requested tools against the registry whitelist.
        var requestedTools = plannerResponse.Tools ?? [];
        var plannedToolNames = requestedTools.Select(t => t.Name).ToList();
        var plannerReason = plannerResponse.Reason;
        var validatedToolRequests = FilterToAllowedTools(requestedTools);

        // Step 5: Execute all allowed tools.
        var toolExecutionOutputs = await ExecuteToolRequestsAsync(
            validatedToolRequests,
            cancellationToken
        );

        // Step 6: Build the evidence package from tool outputs.
        var evidencePackage = BuildEvidencePackage(command, toolExecutionOutputs);

        // Step 7: Generate the final grounded answer from the evidence package.
        var finalAnswer = await agentPlanner.GenerateFinalAnswerAsync(
            command.Question,
            evidencePackage,
            cancellationToken,
            command.ModelOverride
        );

        // Step 8: Validate the final answer.
        var validationResult = AgentResponseValidator.Validate(finalAnswer, evidencePackage);

        return BuildEvidenceBackedAgentAskResult(
            conversationId,
            InvestigationPath.LlmPlanned,
            evidencePackage,
            finalAnswer,
            validatedToolRequests,
            toolExecutionOutputs,
            plannedToolNames,
            plannerReason,
            validationResult.HasWarning,
            mergeEvidenceLimitations: true
        );
    }

    private async Task<AgentAskResult> AnswerDeterministicVisualRequestAsync(
        string conversationId,
        AgentAskCommand command,
        DeterministicVisualPlan visualPlan,
        CancellationToken cancellationToken
    )
    {
        var toolRequests = BuildDeterministicVisualToolRequests(
            visualPlan,
            command.SelectedFileIds
        );
        var toolExecutionOutputs = await ExecuteToolRequestsAsync(toolRequests, cancellationToken);
        var evidencePackage = BuildEvidencePackage(command, toolExecutionOutputs);

        var finalAnswer = await agentPlanner.GenerateFinalAnswerAsync(
            command.Question,
            evidencePackage,
            cancellationToken,
            command.ModelOverride
        );

        var validationResult = AgentResponseValidator.Validate(finalAnswer, evidencePackage);
        return BuildEvidenceBackedAgentAskResult(
            conversationId,
            InvestigationPath.DeterministicVisual,
            evidencePackage,
            finalAnswer,
            toolRequests,
            toolExecutionOutputs,
            visualPlan.ToolNames,
            visualPlan.Reason,
            validationResult.HasWarning,
            mergeEvidenceLimitations: true
        );
    }

    private static List<PlannerToolRequest> BuildDeterministicVisualToolRequests(
        DeterministicVisualPlan visualPlan,
        IReadOnlyList<string> selectedFileIds
    )
    {
        var toolRequests = new List<PlannerToolRequest>();
        foreach (var toolName in visualPlan.ToolNames)
        {
            if (toolName == AgentToolNames.RunEventDetection)
            {
                foreach (var fileId in selectedFileIds)
                {
                    toolRequests.Add(
                        new PlannerToolRequest
                        {
                            Name = toolName,
                            Arguments = new Dictionary<string, object?>
                            {
                                ["fileId"] = fileId,
                                ["kind"] = "clipping",
                            },
                        }
                    );
                }

                continue;
            }

            toolRequests.Add(
                new PlannerToolRequest
                {
                    Name = toolName,
                    Arguments = new Dictionary<string, object?> { ["fileIds"] = selectedFileIds },
                }
            );
        }

        return toolRequests;
    }

    private async Task<AgentAskResult> AnswerDeterministicFactAsync(
        string conversationId,
        AgentAskCommand command,
        DeterministicFactPlan deterministicPlan,
        CancellationToken cancellationToken
    )
    {
        var toolRequest = new PlannerToolRequest
        {
            Name = deterministicPlan.ToolName,
            Arguments = new Dictionary<string, object?> { ["fileIds"] = command.SelectedFileIds },
        };

        var toolExecutionOutputs = await ExecuteToolRequestsAsync([toolRequest], cancellationToken);
        var evidencePackage = BuildEvidencePackage(command, toolExecutionOutputs);
        var finalAnswer = DeterministicAnswerWriter.Write(deterministicPlan, evidencePackage);

        return BuildEvidenceBackedAgentAskResult(
            conversationId,
            InvestigationPath.DeterministicFact,
            evidencePackage,
            finalAnswer,
            [],
            toolExecutionOutputs,
            [deterministicPlan.ToolName],
            plannerReason: null,
            validationWarning: false,
            mergeEvidenceLimitations: false
        );
    }

    private AgentAskResult BuildEvidenceBackedAgentAskResult(
        string conversationId,
        InvestigationPath investigationPath,
        EvidencePackage evidencePackage,
        FinalAnswerResponse finalAnswer,
        List<PlannerToolRequest> plannedToolTraceRequests,
        List<ToolExecutionOutput> toolExecutionOutputs,
        IReadOnlyList<string> plannedToolNames,
        string? plannerReason,
        bool validationWarning,
        bool mergeEvidenceLimitations
    )
    {
        var visualizationPlan = ExpertVisualizationPlanner.Plan(evidencePackage);
        var toolExecutionRecords = AgentResultBuilder.BuildToolExecutionRecords(
            toolExecutionOutputs
        );
        var toolResultsData = AgentResultBuilder.BuildToolResultsData(toolExecutionOutputs);
        var answer = finalAnswer.Answer;

        var plannedToolTraces = AgentResultBuilder.BuildPlannedToolTraces(plannedToolTraceRequests);
        var toolExecutionTraces = AgentResultBuilder.BuildToolExecutionTraces(toolExecutionOutputs);

        var investigationTrace = AgentResultBuilder.BuildInvestigationTrace(
            conversationId,
            evidencePackage.UserQuestion,
            investigationPath,
            plannedToolTraces,
            toolExecutionTraces,
            answer,
            finalAnswer.Confidence,
            visualizationPlan
        );

        investigationTraceStore.Store(investigationTrace);

        var plotHintsLookup = AgentResultBuilder.BuildPlotHintsLookup(
            visualizationPlan,
            evidencePackage
        );
        var overlayBlocks = AgentVisualizationBlockBuilder.BuildSpectrumOverlayBlocks(
            visualizationPlan,
            evidencePackage
        );
        var investigationBlocks = AgentVisualizationBlockBuilder.BuildInvestigationBlocks(
            visualizationPlan,
            evidencePackage
        );
        var soundQualityComparisonBlocks =
            AgentVisualizationBlockBuilder.BuildSoundQualityComparisonBlocks(
                visualizationPlan,
                evidencePackage
            );
        var responseBlocks = AgentResultBuilder.SuppressBlocksCoveredByCombinedVisuals(
            finalAnswer.Blocks,
            visualizationPlan,
            evidencePackage
        );

        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: answer,
            EvidencePackageId: evidencePackage.EvidencePackageId,
            EvidenceReferences: finalAnswer.EvidenceReferences,
            EvidenceItems: AgentResultBuilder.BuildEvidenceItems(evidencePackage),
            Confidence: finalAnswer.Confidence,
            Limitations: mergeEvidenceLimitations
                ? AgentResultBuilder.MergeAndDeduplicate(
                    finalAnswer.Limitations,
                    evidencePackage.Limitations
                )
                : finalAnswer.Limitations,
            SuggestedNextSteps: finalAnswer.SuggestedNextSteps,
            ToolExecutions: toolExecutionRecords,
            ValidationWarning: validationWarning,
            ToolResultsData: toolResultsData,
            PlannedTools: plannedToolNames,
            PlannerReason: plannerReason,
            InvestigationTrace: investigationTrace,
            Blocks: responseBlocks,
            PlotHintsMap: plotHintsLookup.Count > 0 ? plotHintsLookup : null,
            OverlayBlocks: overlayBlocks.Count > 0 ? overlayBlocks : null,
            InvestigationBlocks: investigationBlocks.Count > 0 ? investigationBlocks : null,
            SoundQualityComparisonBlocks: soundQualityComparisonBlocks.Count > 0
                ? soundQualityComparisonBlocks
                : null
        );
    }

    private async Task<List<ToolExecutionOutput>> ExecuteToolRequestsAsync(
        List<PlannerToolRequest> toolRequests,
        CancellationToken cancellationToken
    )
    {
        var toolExecutionOutputs = new List<ToolExecutionOutput>();
        foreach (var toolRequest in toolRequests)
        {
            var toolOutput = await toolExecutionService.ExecuteToolAsync(
                toolRequest,
                cancellationToken
            );
            toolExecutionOutputs.Add(toolOutput);
        }

        return toolExecutionOutputs;
    }

    private EvidencePackage BuildEvidencePackage(
        AgentAskCommand command,
        List<ToolExecutionOutput> toolExecutionOutputs
    )
    {
        var selectedFileNames = ResolveFileNames(command.SelectedFileIds);
        return EvidencePackageBuilder.Build(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            toolExecutionOutputs
        );
    }

    private IReadOnlyList<string> ResolveFileNames(IReadOnlyList<string> fileIds)
    {
        var fileNames = new List<string>();

        foreach (var fileId in fileIds)
        {
            var filePath = audioFileRepository.GetFilePath(fileId);
            if (!string.IsNullOrEmpty(filePath))
            {
                var storedName = Path.GetFileName(filePath);
                // Stored format is "{fileId}_{originalName}" — strip the ID prefix.
                var prefix = fileId + "_";
                var originalName = storedName.StartsWith(prefix, StringComparison.Ordinal)
                    ? storedName[prefix.Length..]
                    : storedName;
                fileNames.Add(originalName);
            }
            else
            {
                fileNames.Add(fileId);
            }
        }

        return fileNames;
    }

    private static List<PlannerToolRequest> FilterToAllowedTools(
        List<PlannerToolRequest> requestedTools
    )
    {
        var allowedTools = new List<PlannerToolRequest>();

        foreach (var toolRequest in requestedTools)
        {
            if (AgentToolRegistry.IsToolAllowed(toolRequest.Name))
            {
                allowedTools.Add(toolRequest);
            }
        }

        return allowedTools;
    }

    private static bool AppearsToBeAudioAnalysisQuestion(string question)
    {
        var normalized = question.Trim().ToLowerInvariant();

        // These are meta questions already handled by AgentMetaQuestionRouter
        // If they got here, the meta router didn't handle them, so they're likely audio questions
        var metaHandledPhrases = new[]
        {
            "why did you analyse both",
            "why did you analyze both",
            "why did you analyse all",
            "why did you analyze all",
            "why are you analysing both",
            "why are you analyzing both",
            "why are you analysing all",
            "why are you analyzing all",
            "click spectrogram evidence pill",
            "click the spectrogram evidence pill",
            "click evidence pill",
            "click the evidence pill",
            "inspect workspace card",
            "inspect the workspace card",
            "open workspace card",
            "open the workspace card",
        };

        foreach (var phrase in metaHandledPhrases)
        {
            if (normalized.Contains(phrase))
            {
                return false;
            }
        }

        // Audio-related keywords that suggest the user wants to analyze audio
        var audioKeywords = new[]
        {
            "sound",
            "audio",
            "file",
            "waveform",
            "spectrogram",
            "spectrum",
            "frequency",
            "hz",
            "khz",
            "peak",
            "rms",
            "db",
            "decibel",
            "loud",
            "quiet",
            "noise",
            "clip",
            "silence",
            "click",
            "analyze",
            "analysis",
            "measure",
            "show",
            "display",
            "what is the",
            "what's the",
            "how does",
            "does it",
            "energy",
            "band",
            "tone",
            "harmonic",
            "distortion",
        };

        foreach (var keyword in audioKeywords)
        {
            if (normalized.Contains(keyword))
            {
                return true;
            }
        }

        return false;
    }

    // Test helper method to expose the private AppearsToBeAudioAnalysisQuestion for unit testing
    internal static bool TestAppearsToBeAudioAnalysisQuestion(string question)
    {
        return AppearsToBeAudioAnalysisQuestion(question);
    }
}
