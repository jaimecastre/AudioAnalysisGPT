using System.Text.Json;
using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public class AgentResponseBlockSerializationTests
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    [Fact]
    public void MarkdownBlock_Serializes_And_Deserializes_Correctly()
    {
        var block = new MarkdownBlock { Content = "Test markdown content with **bold** text." };

        var json = JsonSerializer.Serialize(block, JsonOptions);
        var document = JsonDocument.Parse(json);

        Assert.Equal("markdown", document.RootElement.GetProperty("blockType").GetString());
        Assert.Equal(
            "Test markdown content with **bold** text.",
            document.RootElement.GetProperty("content").GetString()
        );
    }

    [Fact]
    public void StatisticsBlock_Serializes_With_All_Rows()
    {
        var block = new StatisticsBlock
        {
            Title = "Level Metrics",
            Rows =
            [
                new StatisticRow
                {
                    Label = "Peak",
                    Value = "-3.2",
                    Unit = "dBFS",
                },
                new StatisticRow
                {
                    Label = "RMS",
                    Value = "-15.1",
                    Unit = "dBFS",
                },
                new StatisticRow
                {
                    Label = "Crest Factor",
                    Value = "11.9",
                    Unit = "dB",
                },
            ],
        };

        var json = JsonSerializer.Serialize(block, JsonOptions);
        var document = JsonDocument.Parse(json);

        Assert.Equal("statistics", document.RootElement.GetProperty("blockType").GetString());
        Assert.Equal("Level Metrics", document.RootElement.GetProperty("title").GetString());
        var rows = document.RootElement.GetProperty("rows");
        Assert.Equal(3, rows.GetArrayLength());
    }

    [Fact]
    public void SpectrumChartBlock_Serializes_With_Metadata()
    {
        var block = new SpectrumChartBlock
        {
            FileId = "file_123",
            FileName = "sine_500hz.wav",
            FrequenciesHz = [0, 100, 200, 500, 1000],
            MagnitudesDb = [-120, -100, -80, -3.2, -60],
            PeakFrequencyHz = 500.0,
            Metadata = new ChartMetadata
            {
                SourceTool = "run_spectrum",
                FftSize = 8192,
                WindowType = "Hann",
                Scaling = "amplitude",
            },
        };

        var json = JsonSerializer.Serialize(block, JsonOptions);
        var document = JsonDocument.Parse(json);

        Assert.Equal("spectrumChart", document.RootElement.GetProperty("blockType").GetString());
        Assert.Equal("file_123", document.RootElement.GetProperty("fileId").GetString());
        Assert.Equal("sine_500hz.wav", document.RootElement.GetProperty("fileName").GetString());
        Assert.Equal(500.0, document.RootElement.GetProperty("peakFrequencyHz").GetDouble());
        Assert.Equal(5, document.RootElement.GetProperty("frequenciesHz").GetArrayLength());

        var metadata = document.RootElement.GetProperty("metadata");
        Assert.Equal("run_spectrum", metadata.GetProperty("sourceTool").GetString());
        Assert.Equal(8192, metadata.GetProperty("fftSize").GetInt32());
    }

    [Fact]
    public void RankingBlock_Serializes_RankedItems()
    {
        var block = new RankingBlock
        {
            Title = "Files by Loudness",
            MetricName = "loudness",
            RankedItems =
            [
                new RankedItem
                {
                    Rank = 1,
                    FileId = "file_A",
                    FileName = "product_A.wav",
                    Score = 12.5,
                    ScoreLabel = "Loudness",
                    ScoreUnit = "sone",
                },
                new RankedItem
                {
                    Rank = 2,
                    FileId = "file_B",
                    FileName = "product_B.wav",
                    Score = 8.3,
                    ScoreLabel = "Loudness",
                    ScoreUnit = "sone",
                },
            ],
        };

        var json = JsonSerializer.Serialize(block, JsonOptions);
        var document = JsonDocument.Parse(json);

        Assert.Equal("ranking", document.RootElement.GetProperty("blockType").GetString());
        Assert.Equal("Files by Loudness", document.RootElement.GetProperty("title").GetString());
        var items = document.RootElement.GetProperty("rankedItems");
        Assert.Equal(2, items.GetArrayLength());
        Assert.Equal(1, items[0].GetProperty("rank").GetInt32());
        Assert.Equal("product_A.wav", items[0].GetProperty("fileName").GetString());
    }

    [Fact]
    public void SuggestedActionsBlock_Serializes_Actions()
    {
        var block = new SuggestedActionsBlock
        {
            Actions =
            [
                new SuggestedAction
                {
                    Label = "Check for clipping",
                    ActionType = "run_tool",
                    ToolName = "run_event_detection",
                },
                new SuggestedAction
                {
                    Label = "Compare with reference",
                    ActionType = "run_tool",
                    ToolName = "run_basic_metrics",
                },
            ],
        };

        var json = JsonSerializer.Serialize(block, JsonOptions);
        var document = JsonDocument.Parse(json);

        Assert.Equal("suggestedActions", document.RootElement.GetProperty("blockType").GetString());
        var actions = document.RootElement.GetProperty("actions");
        Assert.Equal(2, actions.GetArrayLength());
        Assert.Equal("Check for clipping", actions[0].GetProperty("label").GetString());
        Assert.Equal("run_event_detection", actions[0].GetProperty("toolName").GetString());
    }

    [Fact]
    public void FinalAnswerResponse_Deserializes_With_Blocks()
    {
        const string json = """
            {
                "answer": "Analysis complete.",
                "evidenceReferences": ["ref_1"],
                "confidence": "high",
                "limitations": [],
                "suggestedNextSteps": ["Run CPB analysis"],
                "blocks": [
                    { "blockType": "markdown", "content": "The file shows a clean 500 Hz sine tone." },
                    { "blockType": "statistics", "title": "Level Metrics", "rows": [{ "label": "Peak", "value": "-3.2", "unit": "dBFS" }] }
                ]
            }
            """;

        var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("Analysis complete.", root.GetProperty("answer").GetString());
        Assert.Equal("high", root.GetProperty("confidence").GetString());
        Assert.True(root.TryGetProperty("blocks", out var blocksElement));
        Assert.Equal(2, blocksElement.GetArrayLength());
        Assert.Equal("markdown", blocksElement[0].GetProperty("blockType").GetString());
        Assert.Equal("statistics", blocksElement[1].GetProperty("blockType").GetString());
    }

    [Fact]
    public void FinalAnswerResponse_Deserializes_With_Empty_Blocks()
    {
        const string json = """
            {
                "answer": "Simple answer.",
                "evidenceReferences": [],
                "confidence": "medium",
                "limitations": [],
                "suggestedNextSteps": []
            }
            """;

        var document = JsonDocument.Parse(json);
        var root = document.RootElement;

        Assert.Equal("Simple answer.", root.GetProperty("answer").GetString());
        Assert.False(root.TryGetProperty("blocks", out _));
    }

    [Fact]
    public void FinalAnswerResponse_Handles_Null_Blocks_Gracefully()
    {
        var response = new FinalAnswerResponse
        {
            Answer = "Test",
            EvidenceReferences = [],
            Confidence = "low",
            Limitations = [],
            SuggestedNextSteps = [],
            Blocks = null,
        };

        var json = JsonSerializer.Serialize(response, JsonOptions);
        var deserialized = JsonSerializer.Deserialize<FinalAnswerResponse>(json, JsonOptions);

        Assert.NotNull(deserialized);
        Assert.Null(deserialized.Blocks);
    }

    [Fact]
    public void BuildResponseBlocks_Parses_StatisticsBlock_With_Rows()
    {
        const string json = """
            {
                "answer": "Analysis complete.",
                "evidenceReferences": [],
                "confidence": "high",
                "limitations": [],
                "suggestedNextSteps": [],
                "blocks": [
                    {
                        "blockType": "statistics",
                        "title": "Level Metrics",
                        "rows": [
                            { "label": "Peak", "value": "-3.2", "unit": "dBFS" },
                            { "label": "RMS", "value": "-15.1", "unit": "dBFS" }
                        ]
                    }
                ]
            }
            """;

        var response = JsonSerializer.Deserialize<FinalAnswerResponse>(json, JsonOptions);
        Assert.NotNull(response);
        Assert.NotNull(response.Blocks);
        Assert.Single(response.Blocks);

        var blocks = AgentResultBuilder.BuildResponseBlocks(response);
        Assert.NotNull(blocks);
        Assert.Single(blocks);
        Assert.IsType<StatisticsBlock>(blocks[0]);

        var statsBlock = (StatisticsBlock)blocks[0];
        Assert.Equal("Level Metrics", statsBlock.Title);
        Assert.Equal(2, statsBlock.Rows.Count);
        Assert.Equal("Peak", statsBlock.Rows[0].Label);
        Assert.Equal("-3.2", statsBlock.Rows[0].Value);
    }

    [Fact]
    public void BuildResponseBlocks_Parses_SpectrumChartBlock_With_Data()
    {
        const string json = """
            {
                "answer": "Analysis complete.",
                "evidenceReferences": [],
                "confidence": "high",
                "limitations": [],
                "suggestedNextSteps": [],
                "blocks": [
                    {
                        "blockType": "spectrumChart",
                        "fileId": "file_123",
                        "fileName": "test.wav",
                        "frequenciesHz": [100, 200, 300],
                        "magnitudesDb": [-80, -60, -40],
                        "peakFrequencyHz": 200.0,
                        "metadata": {
                            "sourceTool": "run_spectrum",
                            "fftSize": 8192,
                            "windowType": "Hann"
                        }
                    }
                ]
            }
            """;

        var response = JsonSerializer.Deserialize<FinalAnswerResponse>(json, JsonOptions);
        Assert.NotNull(response);
        Assert.NotNull(response.Blocks);

        var blocks = AgentResultBuilder.BuildResponseBlocks(response);
        Assert.NotNull(blocks);
        Assert.Single(blocks);
        Assert.IsType<SpectrumChartBlock>(blocks[0]);

        var chartBlock = (SpectrumChartBlock)blocks[0];
        Assert.Equal("test.wav", chartBlock.FileName);
        Assert.Equal(3, chartBlock.FrequenciesHz.Count);
        Assert.Equal(200.0, chartBlock.PeakFrequencyHz);
    }

    [Fact]
    public void SuppressBlocksCoveredByCombinedVisuals_RemovesSpectrumAnalysisViewsCoveredByOverlay()
    {
        var blocks = new List<JsonElement>
        {
            JsonSerializer.SerializeToElement(
                new
                {
                    blockType = "analysisView",
                    viewType = "spectrum",
                    resultId = "spectrum_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    fileId = "file-1",
                    fileName = "a.wav",
                    title = "Spectrum Analysis",
                    summary = new { statusText = "Complete", statusIndicator = "success" },
                },
                JsonOptions
            ),
            JsonSerializer.SerializeToElement(
                new { blockType = "markdown", content = "Keep this text." },
                JsonOptions
            ),
        };
        var evidencePackage = BuildSpectrumOverlayEvidencePackage();
        var visualizationPlan = BuildSpectrumOverlayVisualizationPlan();

        var filteredBlocks = AgentResultBuilder.SuppressBlocksCoveredByCombinedVisuals(
            blocks,
            visualizationPlan,
            evidencePackage
        );

        Assert.NotNull(filteredBlocks);
        var block = Assert.Single(filteredBlocks!);
        Assert.Equal("markdown", block.GetProperty("blockType").GetString());
    }

    [Fact]
    public void SuppressBlocksCoveredByCombinedVisuals_RemovesSpectrumChartsWhenOverlayExists()
    {
        var blocks = new List<JsonElement>
        {
            JsonSerializer.SerializeToElement(
                new
                {
                    blockType = "spectrumChart",
                    fileId = "file-1",
                    fileName = "a.wav",
                    frequenciesHz = new[] { 100.0, 200.0 },
                    magnitudesDb = new[] { 50.0, 45.0 },
                },
                JsonOptions
            ),
            JsonSerializer.SerializeToElement(
                new
                {
                    blockType = "analysisView",
                    viewType = "cpb",
                    resultId = "cpb_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    fileId = "file-1",
                    fileName = "a.wav",
                    summary = new { statusText = "Complete", statusIndicator = "success" },
                },
                JsonOptions
            ),
        };
        var evidencePackage = BuildSpectrumOverlayEvidencePackage();
        var visualizationPlan = BuildSpectrumOverlayVisualizationPlan();

        var filteredBlocks = AgentResultBuilder.SuppressBlocksCoveredByCombinedVisuals(
            blocks,
            visualizationPlan,
            evidencePackage
        );

        Assert.NotNull(filteredBlocks);
        var block = Assert.Single(filteredBlocks!);
        Assert.Equal("analysisView", block.GetProperty("blockType").GetString());
        Assert.Equal("cpb", block.GetProperty("viewType").GetString());
    }

    private static EvidencePackage BuildSpectrumOverlayEvidencePackage()
    {
        return new EvidencePackage
        {
            EvidencePackageId = "pkg-1",
            UserQuestion = "compare the spectrum of the different files",
            SelectedFileIds = ["file-1", "file-2"],
            AnalysesRun = ["run_spectrum"],
            KeyEvidence =
            [
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file1",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-1",
                        ["fileName"] = "a.wav",
                        ["resultId"] = "spectrum_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                    },
                },
                new EvidenceItem
                {
                    EvidenceId = "ev_spectrum_file2",
                    Type = "spectrum",
                    Data = new Dictionary<string, object?>
                    {
                        ["fileId"] = "file-2",
                        ["fileName"] = "b.wav",
                        ["resultId"] = "spectrum_cccccccccccccccccccccccccccccccc",
                    },
                },
            ],
            Limitations = [],
        };
    }

    private static VisualizationPlan BuildSpectrumOverlayVisualizationPlan()
    {
        return new VisualizationPlan
        {
            PrimaryEvidenceType = "spectrum",
            Blocks =
            [
                new VisualizationPlanBlock
                {
                    BlockType = "markdown",
                    Reason = "Summarize measured evidence.",
                },
                new VisualizationPlanBlock
                {
                    BlockType = "spectrumOverlay",
                    SourceEvidenceId = "ev_spectrum_file1",
                    SourceEvidenceIds = ["ev_spectrum_file1", "ev_spectrum_file2"],
                    Reason = "Overlay spectrum results.",
                },
            ],
        };
    }
}
