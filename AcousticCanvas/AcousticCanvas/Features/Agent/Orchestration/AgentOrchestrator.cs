using AcousticCanvas.Features.Agent.Commands;
using AcousticCanvas.Features.AudioUpload.Handlers;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed class AgentOrchestrator(
    AgentPlanner agentPlanner,
    ToolExecutionService toolExecutionService,
    UploadAudioHandler uploadAudioHandler)
{
    public async Task<AgentAskResult> HandleUserQuestionAsync(
        AgentAskCommand command,
        CancellationToken cancellationToken)
    {
        var conversationId = "conv_" + Guid.NewGuid().ToString("N")[..8];

        // Step 1: Resolve file names for the selected file IDs.
        var selectedFileNames = ResolveFileNames(command.SelectedFileIds);

        // Step 2: Ask the planner what tools are needed.
        var plannerResponse = await agentPlanner.PlanRequiredToolsAsync(
            command.Question,
            command.SelectedFileIds,
            selectedFileNames,
            cancellationToken);

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
            toolExecutionOutputs);

        // Step 7: Generate the final grounded answer from the evidence package.
        var finalAnswer = await agentPlanner.GenerateFinalAnswerAsync(
            command.Question,
            evidencePackage,
            cancellationToken);

        // Step 8: Validate the final answer.
        var validationResult = AgentResponseValidator.Validate(finalAnswer, evidencePackage);

        // Step 9: Build and return the result.
        var toolExecutionRecords = BuildToolExecutionRecords(toolExecutionOutputs);

        return new AgentAskResult(
            ConversationId: conversationId,
            Answer: finalAnswer.Answer,
            EvidencePackageId: evidencePackage.EvidencePackageId,
            EvidenceReferences: finalAnswer.EvidenceReferences,
            Confidence: finalAnswer.Confidence,
            Limitations: MergeAndDeduplicate(finalAnswer.Limitations, evidencePackage.Limitations),
            SuggestedNextSteps: finalAnswer.SuggestedNextSteps,
            ToolExecutions: toolExecutionRecords,
            ValidationWarning: validationResult.HasWarning);
    }

    private IReadOnlyList<string> ResolveFileNames(IReadOnlyList<string> fileIds)
    {
        var fileNames = new List<string>();

        foreach (var fileId in fileIds)
        {
            var filePath = uploadAudioHandler.GetFilePath(fileId);
            if (!string.IsNullOrEmpty(filePath))
            {
                fileNames.Add(Path.GetFileName(filePath));
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
            Confidence: "low",
            Limitations: ["Clarification needed before analysis can run."],
            SuggestedNextSteps: [],
            ToolExecutions: [],
            ValidationWarning: false);
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
            Confidence: "low",
            Limitations: ["No analysis was run for this response."],
            SuggestedNextSteps: [$"To analyze this file, ask a specific question such as: 'Is there clipping in {userQuestion}'"],
            ToolExecutions: [],
            ValidationWarning: false);
    }
}
