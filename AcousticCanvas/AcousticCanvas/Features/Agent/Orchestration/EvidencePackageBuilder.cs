using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration.EvidenceExtractors;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class EvidencePackageBuilder
{
    private static readonly JsonSerializerOptions JsonReadOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };

    public static EvidencePackage Build(
        string userQuestion,
        IReadOnlyList<string> selectedFileIds,
        IReadOnlyList<string> selectedFileNames,
        IReadOnlyList<ToolExecutionOutput> toolOutputs
    )
    {
        var evidencePackageId = "ev_" + Guid.NewGuid().ToString("N")[..8];
        var analysesRun = new List<string>();
        var keyEvidence = new List<EvidenceItem>();
        var limitations = new List<string>();

        var fileIdToNameMap = new Dictionary<string, string>();
        for (var i = 0; i < Math.Min(selectedFileIds.Count, selectedFileNames.Count); i++)
        {
            fileIdToNameMap[selectedFileIds[i]] = selectedFileNames[i];
        }

        foreach (var toolOutput in toolOutputs)
        {
            if (toolOutput.Status != "completed" || toolOutput.ResultData is null)
            {
                limitations.Add(
                    $"Tool '{toolOutput.ToolName}' failed: {toolOutput.ErrorMessage ?? "unknown error"}."
                );
                continue;
            }

            analysesRun.Add(toolOutput.ToolName);

            var evidenceItems = ExtractEvidenceItemsFromToolOutput(toolOutput, fileIdToNameMap);
            keyEvidence.AddRange(evidenceItems);
        }

        AddStandardLimitations(limitations, analysesRun);

        return new EvidencePackage
        {
            EvidencePackageId = evidencePackageId,
            UserQuestion = userQuestion,
            SelectedFileIds = selectedFileIds,
            AnalysesRun = analysesRun,
            KeyEvidence = keyEvidence,
            Limitations = limitations,
        };
    }

    private static List<EvidenceItem> ExtractEvidenceItemsFromToolOutput(
        ToolExecutionOutput toolOutput,
        Dictionary<string, string> fileIdToNameMap
    )
    {
        var evidenceItems = new List<EvidenceItem>();

        var serializedData = JsonSerializer.Serialize(toolOutput.ResultData);
        JsonElement parsedData;

        try
        {
            parsedData = JsonSerializer.Deserialize<JsonElement>(serializedData, JsonReadOptions);
        }
        catch
        {
            return evidenceItems;
        }

        if (toolOutput.ToolName == AgentToolNames.RunBasicMetrics)
        {
            BasicMetricsEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunEventDetection)
        {
            EventDetectionEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunSpectrum)
        {
            SpectrumEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunSpectrogram)
        {
            SpectrogramEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunCpb)
        {
            CpbEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunSoundQualityMetrics)
        {
            SoundQualityEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.RunFindings)
        {
            FindingsEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == AgentToolNames.GetMetadata)
        {
            MetadataEvidenceExtractor.Extract(parsedData, evidenceItems, fileIdToNameMap);
        }

        return evidenceItems;
    }

    private static void AddStandardLimitations(List<string> limitations, List<string> analysesRun)
    {
        if (
            analysesRun.Contains(AgentToolNames.RunBasicMetrics)
            || analysesRun.Contains(AgentToolNames.RunEventDetection)
        )
        {
            limitations.Add(
                "Only digital clipping was assessed. Analog distortion is not detectable from the digital signal."
            );
        }

        if (analysesRun.Contains(AgentToolNames.RunCpb))
        {
            // TODO: Current CPB uses FFT-bin power summation. Not IEC 61260 compliant.
            limitations.Add(
                "CPB analysis uses FFT-bin power summation (nominal approximation, not IEC 61260 filter-bank)."
            );
        }
    }
}
