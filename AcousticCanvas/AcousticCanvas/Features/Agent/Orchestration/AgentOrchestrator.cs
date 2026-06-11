using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.Agent.Services;
using AcousticCanvas.Features.AudioUpload.Services;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentOrchestrator(
    AgentPlanner agentPlanner,
    ToolExecutionService toolExecutionService,
    AudioFileRepository audioFileRepository,
    IInvestigationTraceStore investigationTraceStore)
{
    public async Task<AgentAskResult> HandleUserQuestionAsync(
        AgentAskCommand command,
        CancellationToken cancellationToken)
    {
        var conversationId = "conv_" + Guid.NewGuid().ToString("N")[..8];

        var metaAnswer = AgentMetaQuestionRouter.TryAnswer(command.Question);
        if (metaAnswer is not null)
        {
            var metaInvestigationTrace = BuildInvestigationTrace(
                conversationId,
                command.Question,
                InvestigationPath.MetaQuestion,
                [],
                [],
                metaAnswer,
                "high");

            investigationTraceStore.Store(metaInvestigationTrace);

            return BuildNoToolConversationResult(conversationId, metaAnswer, metaInvestigationTrace);
        }

        // Check if no files are loaded and the question appears to be about audio analysis
        if (command.SelectedFileIds.Count == 0 && AppearsToBeAudioAnalysisQuestion(command.Question))
        {
            var answer = "No audio files are currently loaded. Please upload and select an audio file first, then ask your question about that file.";
            var noFilesInvestigationTrace = BuildInvestigationTrace(
                conversationId,
                command.Question,
                InvestigationPath.NoFiles,
                [],
                [],
                answer,
                "low");

            investigationTraceStore.Store(noFilesInvestigationTrace);

            return BuildNoToolConversationResult(conversationId, answer, noFilesInvestigationTrace);
        }

        // Step 0: Answer plain deterministic-fact questions (peak/RMS/sample rate/etc.)
        // straight from the backend tools, without calling the LLM. This keeps factual
        // lookups fast and working even when no OpenAI key is configured.
        var deterministicPlan = DeterministicFactRouter.TryRoute(command.Question);
        if (deterministicPlan is not null && command.SelectedFileIds.Count > 0)
        {
            return await AnswerDeterministicFactAsync(conversationId, command, deterministicPlan, cancellationToken);
        }

        // Step 1: Resolve file names for the selected file IDs.
        var selectedFileNames = ResolveFileNames(command.SelectedFileIds);

        // Step 2: Ask the planner what tools are needed.
        var plannerResponse = await agentPlanner.PlanRequiredToolsAsync(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            cancellationToken,
            command.ModelOverride);

        // Step 3: Handle non-tool actions.
        if (plannerResponse.Action == "ask_clarification")
        {
            return BuildClarificationResult(
                conversationId,
                plannerResponse.ClarificationQuestion ?? "Could you provide more context?");
        }

        if (plannerResponse.Action == "no_analysis_needed")
        {
            return BuildNoAnalysisResult(
                conversationId,
                command.Question,
                plannerResponse.Reason ?? "No analysis was required for this question.");
        }

        // Step 4: Validate requested tools against the registry whitelist.
        var requestedTools = plannerResponse.Tools ?? [];
        var plannedToolNames = requestedTools.Select(t => t.Name).ToList();
        var plannerReason = plannerResponse.Reason;
        var validatedToolRequests = FilterToAllowedTools(requestedTools);

        // Step 5: Execute all allowed tools.
        var toolExecutionOutputs = new List<ToolExecutionOutput>();
        foreach (var toolRequest in validatedToolRequests)
        {
            var toolOutput = await toolExecutionService.ExecuteToolAsync(toolRequest, cancellationToken);
            toolExecutionOutputs.Add(toolOutput);
        }

        // Step 6: Build the evidence package from tool outputs.
        var evidencePackage = EvidencePackageBuilder.Build(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            toolExecutionOutputs);

        // Step 7: Generate the final grounded answer from the evidence package.
        var finalAnswer = await agentPlanner.GenerateFinalAnswerAsync(
            command.Question,
            evidencePackage,
            cancellationToken,
            command.ModelOverride);

        // Step 8: Validate the final answer.
        var validationResult = AgentResponseValidator.Validate(finalAnswer, evidencePackage);

        // Step 9: Build and return the result.
        var toolExecutionRecords = BuildToolExecutionRecords(toolExecutionOutputs);
        var toolResultsData = BuildToolResultsData(toolExecutionOutputs);
        var answerWithEmbeddedTokens = EmbedEvidenceTokensInAnswer(finalAnswer.Answer, finalAnswer.EvidenceReferences, evidencePackage);

        var plannedToolTraces = BuildPlannedToolTraces(validatedToolRequests);
        var toolExecutionTraces = BuildToolExecutionTraces(toolExecutionOutputs);

        var investigationTrace = BuildInvestigationTrace(
            conversationId,
            command.Question,
            InvestigationPath.LlmPlanned,
            plannedToolTraces,
            toolExecutionTraces,
            answerWithEmbeddedTokens,
            finalAnswer.Confidence);

        investigationTraceStore.Store(investigationTrace);

        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: answerWithEmbeddedTokens,
            EvidencePackageId: evidencePackage.EvidencePackageId,
            EvidenceReferences: finalAnswer.EvidenceReferences,
            EvidenceItems: BuildEvidenceItems(evidencePackage),
            Confidence: finalAnswer.Confidence,
            Limitations: MergeAndDeduplicate(finalAnswer.Limitations, evidencePackage.Limitations),
            SuggestedNextSteps: finalAnswer.SuggestedNextSteps,
            ToolExecutions: toolExecutionRecords,
            ValidationWarning: validationResult.HasWarning,
            ToolResultsData: toolResultsData,
            PlannedTools: plannedToolNames,
            PlannerReason: plannerReason,
            InvestigationTrace: investigationTrace);
    }

    private async Task<AgentAskResult> AnswerDeterministicFactAsync(
        string conversationId,
        AgentAskCommand command,
        DeterministicFactPlan deterministicPlan,
        CancellationToken cancellationToken)
    {
        var toolRequest = new PlannerToolRequest
        {
            Name = deterministicPlan.ToolName,
            Arguments = new Dictionary<string, object?> { ["fileIds"] = command.SelectedFileIds },
        };

        var toolOutput = await toolExecutionService.ExecuteToolAsync(toolRequest, cancellationToken);

        var selectedFileNames = ResolveFileNames(command.SelectedFileIds);
        var evidencePackage = EvidencePackageBuilder.Build(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            [toolOutput]);

        var finalAnswer = DeterministicAnswerWriter.Write(deterministicPlan, evidencePackage);
        var toolExecutionRecords = BuildToolExecutionRecords([toolOutput]);
        var toolResultsData = BuildToolResultsData([toolOutput]);
        var answerWithEmbeddedTokens = EmbedEvidenceTokensInAnswer(finalAnswer.Answer, finalAnswer.EvidenceReferences, evidencePackage);

        var toolExecutionTraces = BuildToolExecutionTraces([toolOutput]);

        var investigationTrace = BuildInvestigationTrace(
            conversationId,
            command.Question,
            InvestigationPath.DeterministicFact,
            [],
            toolExecutionTraces,
            answerWithEmbeddedTokens,
            finalAnswer.Confidence);

        investigationTraceStore.Store(investigationTrace);

        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: answerWithEmbeddedTokens,
            EvidencePackageId: evidencePackage.EvidencePackageId,
            EvidenceReferences: finalAnswer.EvidenceReferences,
            EvidenceItems: BuildEvidenceItems(evidencePackage),
            Confidence: finalAnswer.Confidence,
            Limitations: finalAnswer.Limitations,
            SuggestedNextSteps: finalAnswer.SuggestedNextSteps,
            ToolExecutions: toolExecutionRecords,
            ValidationWarning: false,
            ToolResultsData: toolResultsData,
            PlannedTools: [deterministicPlan.ToolName],
            PlannerReason: null,
            InvestigationTrace: investigationTrace);
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

    private static List<PlannerToolRequest> FilterToAllowedTools(List<PlannerToolRequest> requestedTools)
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

    private static IReadOnlyDictionary<string, object>? BuildToolResultsData(
        IEnumerable<ToolExecutionOutput> toolOutputs)
    {
        var dict = new Dictionary<string, object>();
        foreach (var output in toolOutputs)
        {
            if (output.Status == "completed" && output.ResultData is not null && !string.IsNullOrEmpty(output.ResultRef))
                dict[output.ResultRef] = output.ResultData;
        }
        return dict.Count > 0 ? dict : null;
    }

    private static IReadOnlyList<AgentEvidenceItem> BuildEvidenceItems(EvidencePackage evidencePackage)
    {
        var evidenceItems = new List<AgentEvidenceItem>();

        foreach (var item in evidencePackage.KeyEvidence)
        {
            evidenceItems.Add(new AgentEvidenceItem(
                EvidenceId: item.EvidenceId,
                Type: item.Type,
                Data: item.Data));
        }

        return evidenceItems;
    }

    private static IReadOnlyList<AgentToolExecutionRecord> BuildToolExecutionRecords(
        List<ToolExecutionOutput> toolOutputs)
    {
        var records = new List<AgentToolExecutionRecord>();

        foreach (var output in toolOutputs)
        {
            records.Add(new AgentToolExecutionRecord(
                ToolName: output.ToolName,
                Status: output.Status,
                ResultRef: output.Status == "completed" ? output.ResultRef : null,
                ErrorCode: output.ErrorCode,
                ErrorMessage: output.ErrorMessage));
        }

        return records;
    }

    private static IReadOnlyList<string> MergeAndDeduplicate(
        IReadOnlyList<string> fromAgent,
        IReadOnlyList<string> fromEvidence)
    {
        var merged = new List<string>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var item in fromAgent)
        {
            if (!string.IsNullOrWhiteSpace(item) && seen.Add(item))
            {
                merged.Add(item);
            }
        }

        foreach (var item in fromEvidence)
        {
            if (!string.IsNullOrWhiteSpace(item) && seen.Add(item))
            {
                merged.Add(item);
            }
        }

        return merged;
    }

    private static AgentAskResult BuildClarificationResult(string conversationId, string question)
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: question,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "low",
            Limitations: ["Clarification needed before analysis can run."],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null,
            InvestigationTrace: null);
    }

    private static AgentAskResult BuildNoAnalysisResult(
        string conversationId,
        string userQuestion,
        string reason)
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: reason,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "low",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: null,
            InvestigationTrace: null);
    }

    private static AgentAskResult BuildNoToolConversationResult(string conversationId, string answer, InvestigationTrace investigationTrace)
    {
        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: answer,
            EvidencePackageId: string.Empty,
            EvidenceReferences: [],
            EvidenceItems: [],
            Confidence: "high",
            Limitations: [],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false,
            ToolResultsData: null,
            PlannedTools: [],
            PlannerReason: "Answered as an Agent behavior question; no audio analysis was needed.",
            InvestigationTrace: investigationTrace);
    }

    private static InvestigationTrace BuildInvestigationTrace(
        string conversationId,
        string question,
        InvestigationPath path,
        IReadOnlyList<PlannedToolTrace> plannedTools,
        IReadOnlyList<ToolExecutionTrace> toolExecutions,
        string finalAnswer,
        string confidence)
    {
        return new InvestigationTrace(
            Question: question,
            ConversationId: conversationId,
            Path: path,
            PlannedTools: plannedTools,
            ToolExecutions: toolExecutions,
            FinalAnswer: finalAnswer,
            Confidence: confidence,
            TimestampUtc: DateTime.UtcNow);
    }

    private static IReadOnlyList<PlannedToolTrace> BuildPlannedToolTraces(List<PlannerToolRequest> toolRequests)
    {
        var traces = new List<PlannedToolTrace>();
        foreach (var request in toolRequests)
        {
            traces.Add(new PlannedToolTrace(
                Name: request.Name,
                Arguments: request.Arguments));
        }
        return traces;
    }

    private static IReadOnlyList<ToolExecutionTrace> BuildToolExecutionTraces(List<ToolExecutionOutput> toolOutputs)
    {
        var traces = new List<ToolExecutionTrace>();
        foreach (var output in toolOutputs)
        {
            traces.Add(new ToolExecutionTrace(
                Name: output.ToolName,
                Status: output.Status,
                StartedAtUtc: output.StartedAtUtc,
                FinishedAtUtc: output.FinishedAtUtc,
                ErrorMessage: output.ErrorMessage));
        }
        return traces;
    }

    private static string EmbedEvidenceTokensInAnswer(
        string answer,
        IReadOnlyList<string> evidenceReferences,
        EvidencePackage evidencePackage)
    {
        if (evidenceReferences.Count == 0)
        {
            return answer;
        }

        var tokenStrings = new List<string>();

        foreach (var referenceId in evidenceReferences)
        {
            var matchingEvidenceItem = evidencePackage.KeyEvidence
                .FirstOrDefault(item => item.EvidenceId == referenceId);

            if (matchingEvidenceItem is null)
            {
                continue;
            }

            var frontendType = MapBackendTypeToFrontendType(matchingEvidenceItem.Type);
            var shortId = referenceId.Length > 8 ? referenceId[^8..] : referenceId;
            tokenStrings.Add($"[{frontendType}:{shortId}]");
        }

        if (tokenStrings.Count == 0)
        {
            return answer;
        }

        return answer;
    }

    private static string MapBackendTypeToFrontendType(string backendType)
    {
        return backendType switch
        {
            "basic_metrics" => "analysis_result",
            "event_detection" => "find_result",
            "spectrum" => "analysis_result",
            "spectrogram" => "analysis_result",
            "cpb" => "analysis_result",
            "sound_quality" => "analysis_result",
            "metadata" => "analysis_result",
            _ => "analysis_result"
        };
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
            "sound", "audio", "file", "waveform", "spectrogram", "spectrum",
            "frequency", "hz", "khz", "peak", "rms", "db", "decibel",
            "loud", "quiet", "noise", "clip", "silence", "click",
            "analyze", "analysis", "measure", "show", "display",
            "what is the", "what's the", "how does", "does it",
            "energy", "band", "tone", "harmonic", "distortion"
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
