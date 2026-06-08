using System.Text.Json;

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
        IReadOnlyList<ToolExecutionOutput> toolOutputs)
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
                limitations.Add($"Tool '{toolOutput.ToolName}' failed: {toolOutput.ErrorMessage ?? "unknown error"}.");
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
        Dictionary<string, string> fileIdToNameMap)
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

        if (toolOutput.ToolName == "run_basic_metrics")
        {
            ExtractBasicMetricsEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == "run_event_detection")
        {
            ExtractEventDetectionEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == "run_spectrum")
        {
            ExtractSpectrumEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == "run_cpb")
        {
            ExtractCpbEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == "run_sound_quality_metrics")
        {
            ExtractSoundQualityEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }
        else if (toolOutput.ToolName == "get_metadata")
        {
            ExtractMetadataEvidence(parsedData, evidenceItems, fileIdToNameMap);
        }

        return evidenceItems;
    }

    private static void ExtractBasicMetricsEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("metrics", out var metricsElement))
            {
                continue;
            }

            var evidenceId = "ev_metrics_" + fileId[..Math.Min(fileId.Length, 8)];

            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "basic_metrics",
            };

            if (metricsElement.TryGetProperty("rmsDbFs", out var rmsElement))
            {
                evidenceData["rmsDbFs"] = rmsElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("peakDbFs", out var peakElement))
            {
                evidenceData["peakDbFs"] = peakElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("crestFactorDb", out var crestElement))
            {
                evidenceData["crestFactorDb"] = crestElement.GetDouble();
            }

            if (metricsElement.TryGetProperty("dcOffsetLinear", out var dcOffsetElement))
            {
                evidenceData["dcOffsetLinear"] = dcOffsetElement.GetDouble();
            }

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "basic_metrics",
                Data = evidenceData,
            });
        }
    }

    private static void ExtractEventDetectionEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        var fileId = parsedData.TryGetProperty("fileId", out var fileIdEl) ? fileIdEl.GetString() ?? "unknown" : "unknown";
        var kind = parsedData.TryGetProperty("kind", out var kindEl) ? kindEl.GetString() ?? "unknown" : "unknown";
        var eventCount = parsedData.TryGetProperty("eventCount", out var countEl) ? countEl.GetInt32() : 0;

        var evidenceId = $"ev_{kind}_{fileId[..Math.Min(fileId.Length, 8)]}";

        var evidenceData = new Dictionary<string, object?>
        {
            ["fileId"] = fileId,
            ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
            ["type"] = "event_detection",
            ["kind"] = kind,
            ["eventCount"] = eventCount,
            ["eventsDetected"] = eventCount > 0,
        };

        if (kind == "clipping" && parsedData.TryGetProperty("events", out var eventsArray))
        {
            var firstFewEvents = new List<object?>();
            var eventIndex = 0;

            foreach (var audioEvent in eventsArray.EnumerateArray())
            {
                if (eventIndex >= 3)
                {
                    break;
                }

                var startSeconds = audioEvent.TryGetProperty("startSeconds", out var startEl) ? startEl.GetDouble() : 0.0;
                var endSeconds = audioEvent.TryGetProperty("endSeconds", out var endEl) ? endEl.GetDouble() : 0.0;
                var description = audioEvent.TryGetProperty("description", out var descEl) ? descEl.GetString() : "";

                firstFewEvents.Add(new
                {
                    startSeconds,
                    endSeconds,
                    description,
                });

                eventIndex++;
            }

            evidenceData["firstEvents"] = firstFewEvents;
        }

        evidenceItems.Add(new EvidenceItem
        {
            EvidenceId = evidenceId,
            Type = "event_detection",
            Data = evidenceData,
        });
    }

    private static void ExtractSpectrumEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("summary", out var summaryElement))
            {
                continue;
            }

            var evidenceId = "ev_spectrum_" + fileId[..Math.Min(fileId.Length, 8)];

            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "spectrum",
            };

            if (summaryElement.TryGetProperty("peakFrequencyHz", out var peakFreqEl))
            {
                evidenceData["peakFrequencyHz"] = peakFreqEl.GetDouble();
            }

            if (summaryElement.TryGetProperty("maxMagnitudeDb", out var maxMagEl))
            {
                evidenceData["maxMagnitudeDb"] = maxMagEl.GetDouble();
            }

            if (summaryElement.TryGetProperty("dominantPeaks", out var peaksArray))
            {
                var peaksList = new List<object?>();
                foreach (var peak in peaksArray.EnumerateArray())
                {
                    var freqHz = peak.TryGetProperty("frequencyHz", out var freqEl) ? freqEl.GetDouble() : 0.0;
                    var magDb = peak.TryGetProperty("magnitudeDb", out var magEl) ? magEl.GetDouble() : 0.0;
                    var prominence = peak.TryGetProperty("prominenceDb", out var promEl) ? promEl.GetDouble() : 0.0;
                    var confidence = peak.TryGetProperty("confidence", out var confEl) ? confEl.GetString() : "";

                    peaksList.Add(new
                    {
                        frequencyHz = freqHz,
                        magnitudeDb = magDb,
                        prominenceDb = prominence,
                        confidence,
                    });
                }

                evidenceData["dominantPeaks"] = peaksList;
            }

            if (fileResult.TryGetProperty("dataRef", out var dataRefEl))
            {
                evidenceData["dataRef"] = dataRefEl.GetString();
            }

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "spectrum",
                Data = evidenceData,
            });
        }
    }

    private static void ExtractCpbEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("summary", out var summaryElement))
            {
                continue;
            }

            var evidenceId = "ev_cpb_" + fileId[..Math.Min(fileId.Length, 8)];

            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "cpb",
            };

            if (fileResult.TryGetProperty("bandMode", out var bandModeEl))
            {
                evidenceData["bandMode"] = bandModeEl.GetString();
            }

            if (fileResult.TryGetProperty("method", out var methodEl))
            {
                evidenceData["method"] = methodEl.GetString();
            }

            if (summaryElement.TryGetProperty("highestBands", out var bandsArray))
            {
                var bandsList = new List<object?>();
                foreach (var band in bandsArray.EnumerateArray())
                {
                    var freqHz = band.TryGetProperty("centerFrequencyHz", out var freqEl) ? freqEl.GetDouble() : 0.0;
                    var levelDb = band.TryGetProperty("levelDb", out var levelEl) ? levelEl.GetDouble() : 0.0;
                    var label = band.TryGetProperty("label", out var labelEl) ? labelEl.GetString() : "";

                    bandsList.Add(new
                    {
                        centerFrequencyHz = freqHz,
                        levelDb,
                        label,
                    });
                }

                evidenceData["highestBands"] = bandsList;
            }

            if (fileResult.TryGetProperty("dataRef", out var dataRefEl))
            {
                evidenceData["dataRef"] = dataRefEl.GetString();
            }

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "cpb",
                Data = evidenceData,
            });
        }
    }

    private static void ExtractMetadataEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";
            var evidenceId = "ev_meta_" + fileId[..Math.Min(fileId.Length, 8)];

            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "metadata",
            };

            if (fileResult.TryGetProperty("fileName", out var nameEl))
            {
                evidenceData["fileName"] = nameEl.GetString();
            }

            if (fileResult.TryGetProperty("durationSeconds", out var durationEl))
            {
                evidenceData["durationSeconds"] = durationEl.GetDouble();
            }

            if (fileResult.TryGetProperty("sampleRateHz", out var sampleRateEl))
            {
                evidenceData["sampleRateHz"] = sampleRateEl.GetInt32();
            }

            if (fileResult.TryGetProperty("channels", out var channelsEl))
            {
                evidenceData["channels"] = channelsEl.GetInt32();
            }

            if (fileResult.TryGetProperty("bitDepth", out var bitDepthEl))
            {
                evidenceData["bitDepth"] = bitDepthEl.GetInt32();
            }

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "metadata",
                Data = evidenceData,
            });
        }
    }

    private static void ExtractSoundQualityEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        if (!parsedData.TryGetProperty("results", out var resultsArray))
        {
            return;
        }

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdElement))
            {
                continue;
            }

            var fileId = fileIdElement.GetString() ?? "unknown";
            var evidenceId = "ev_sound_quality_" + fileId[..Math.Min(fileId.Length, 8)];

            var evidenceData = new Dictionary<string, object?>
            {
                ["fileId"] = fileId,
                ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
                ["type"] = "sound_quality",
            };

            if (fileResult.TryGetProperty("method", out var methodElement))
            {
                evidenceData["method"] = methodElement.GetString();
            }

            if (fileResult.TryGetProperty("region", out var regionElement))
            {
                if (regionElement.TryGetProperty("startSeconds", out var startElement))
                {
                    evidenceData["regionStartSeconds"] = startElement.GetDouble();
                }

                if (regionElement.TryGetProperty("endSeconds", out var endElement))
                {
                    evidenceData["regionEndSeconds"] = endElement.GetDouble();
                }
            }

            AddSoundQualityMetricEvidence(fileResult, evidenceData, "loudness", "loudnessSone", "loudnessMethod");
            AddSoundQualityMetricEvidence(fileResult, evidenceData, "sharpness", "sharpnessAcum", "sharpnessMethod");
            AddSoundQualityMetricEvidence(fileResult, evidenceData, "roughness", "roughnessAsper", "roughnessMethod");

            evidenceItems.Add(new EvidenceItem
            {
                EvidenceId = evidenceId,
                Type = "sound_quality",
                Data = evidenceData,
            });
        }
    }

    private static void AddSoundQualityMetricEvidence(
        JsonElement fileResult,
        Dictionary<string, object?> evidenceData,
        string metricPropertyName,
        string valueEvidenceKey,
        string methodEvidenceKey)
    {
        if (!fileResult.TryGetProperty(metricPropertyName, out var metricElement))
        {
            return;
        }

        if (metricElement.TryGetProperty("value", out var valueElement))
        {
            evidenceData[valueEvidenceKey] = valueElement.GetDouble();
        }

        if (metricElement.TryGetProperty("method", out var methodElement))
        {
            evidenceData[methodEvidenceKey] = methodElement.GetString();
        }
    }

    private static void AddStandardLimitations(List<string> limitations, List<string> analysesRun)
    {
        if (analysesRun.Contains("run_basic_metrics") || analysesRun.Contains("run_event_detection"))
        {
            limitations.Add("Only digital clipping was assessed. Analog distortion is not detectable from the digital signal.");
        }

        if (analysesRun.Contains("run_cpb"))
        {
            // TODO: Current CPB uses FFT-bin power summation. Not IEC 61260 compliant.
            limitations.Add("CPB analysis uses FFT-bin power summation (nominal approximation, not IEC 61260 filter-bank).");
        }

        if (!analysesRun.Contains("run_sound_quality_metrics"))
        {
            limitations.Add("No psychoacoustic metrics (loudness, sharpness, roughness) were computed. Sound quality interpretation is based on spectral and level data only.");
        }
    }
}
