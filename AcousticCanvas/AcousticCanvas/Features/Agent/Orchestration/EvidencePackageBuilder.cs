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
        else if (toolOutput.ToolName == "run_findings")
        {
            ExtractFindingsEvidence(parsedData, evidenceItems, fileIdToNameMap);
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

        // When ≥2 files were analysed, emit a pairwise comparison evidence item so the agent
        // can cite level/dynamic differences explicitly.
        TryEmitBasicMetricsComparisonEvidence(resultsArray, evidenceItems, fileIdToNameMap);
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

        // When ≥2 files were analysed, emit a pairwise comparison evidence item so the agent
        // can cite spectral differences explicitly.
        TryEmitSpectrumComparisonEvidence(resultsArray, evidenceItems, fileIdToNameMap);
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

        // When ≥2 files were analysed, also emit a pairwise comparison evidence item so the agent
        // can cite loudness/sharpness/roughness deltas as benchmark evidence.
        TryEmitSoundQualityComparisonEvidence(resultsArray, evidenceItems, fileIdToNameMap);
    }

    private static void TryEmitSoundQualityComparisonEvidence(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        var fileResults = new List<(string FileId, double Loudness, double Sharpness, double Roughness)>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
            {
                continue;
            }

            var fileId = fileIdEl.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("loudness", out var loudnessEl)
                || !loudnessEl.TryGetProperty("value", out var loudnessValEl))
            {
                continue;
            }

            if (!fileResult.TryGetProperty("sharpness", out var sharpnessEl)
                || !sharpnessEl.TryGetProperty("value", out var sharpnessValEl))
            {
                continue;
            }

            if (!fileResult.TryGetProperty("roughness", out var roughnessEl)
                || !roughnessEl.TryGetProperty("value", out var roughnessValEl))
            {
                continue;
            }

            fileResults.Add((fileId, loudnessValEl.GetDouble(), sharpnessValEl.GetDouble(), roughnessValEl.GetDouble()));
        }

        if (fileResults.Count < 2)
        {
            return;
        }

        var a = fileResults[0];
        var b = fileResults[1];

        var loudnessDelta = Math.Round(b.Loudness - a.Loudness, 3);
        var sharpnessDelta = Math.Round(b.Sharpness - a.Sharpness, 4);
        var roughnessDelta = Math.Round(b.Roughness - a.Roughness, 4);

        var cmpEvidenceId = "ev_sq_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(new EvidenceItem
        {
            EvidenceId = cmpEvidenceId,
            Type = "sound_quality_comparison",
            Data = new Dictionary<string, object?>
            {
                ["type"] = "sound_quality_comparison",
                ["fileIdA"] = a.FileId,
                ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                ["fileIdB"] = b.FileId,
                ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                ["loudnessASone"] = Math.Round(a.Loudness, 3),
                ["loudnessBSone"] = Math.Round(b.Loudness, 3),
                ["loudnessDeltaSone"] = loudnessDelta,
                ["louderFileId"] = a.Loudness >= b.Loudness ? a.FileId : b.FileId,
                ["sharpnessAAcum"] = Math.Round(a.Sharpness, 4),
                ["sharpnessBAcum"] = Math.Round(b.Sharpness, 4),
                ["sharpnessDeltaAcum"] = sharpnessDelta,
                ["sharperFileId"] = a.Sharpness >= b.Sharpness ? a.FileId : b.FileId,
                ["roughnessAAsper"] = Math.Round(a.Roughness, 4),
                ["roughnessBAsper"] = Math.Round(b.Roughness, 4),
                ["roughnessDeltaAsper"] = roughnessDelta,
                ["rougherFileId"] = a.Roughness >= b.Roughness ? a.FileId : b.FileId,
            },
        });
    }

    private static void ExtractFindingsEvidence(
        JsonElement parsedData,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        var fileId = parsedData.TryGetProperty("fileId", out var fileIdEl) ? fileIdEl.GetString() ?? "unknown" : "unknown";
        var findingCount = parsedData.TryGetProperty("findingCount", out var countEl) ? countEl.GetInt32() : 0;

        var evidenceId = "ev_findings_" + fileId[..Math.Min(fileId.Length, 8)];

        var evidenceData = new Dictionary<string, object?>
        {
            ["fileId"] = fileId,
            ["fileName"] = fileIdToNameMap.GetValueOrDefault(fileId, fileId),
            ["type"] = "findings",
            ["findingCount"] = findingCount,
        };

        if (parsedData.TryGetProperty("findings", out var findingsArray))
        {
            var findingsList = new List<object?>();

            foreach (var finding in findingsArray.EnumerateArray())
            {
                var findingType = finding.TryGetProperty("type", out var typeEl) ? typeEl.GetString() : null;
                var severity = finding.TryGetProperty("severity", out var sevEl) ? sevEl.GetString() : null;
                var confidence = finding.TryGetProperty("confidence", out var confEl) ? confEl.GetString() : null;
                var title = finding.TryGetProperty("title", out var titleEl) ? titleEl.GetString() : null;
                var description = finding.TryGetProperty("description", out var descEl) ? descEl.GetString() : null;
                var suggestedNextStep = finding.TryGetProperty("suggestedNextStep", out var nextEl) ? nextEl.GetString() : null;
                double? startSeconds = finding.TryGetProperty("startSeconds", out var startEl) && startEl.ValueKind != JsonValueKind.Null
                    ? startEl.GetDouble() : null;
                double? endSeconds = finding.TryGetProperty("endSeconds", out var endEl) && endEl.ValueKind != JsonValueKind.Null
                    ? endEl.GetDouble() : null;
                double? frequencyHz = finding.TryGetProperty("frequencyHz", out var freqEl) && freqEl.ValueKind != JsonValueKind.Null
                    ? freqEl.GetDouble() : null;

                findingsList.Add(new
                {
                    type = findingType,
                    severity,
                    confidence,
                    title,
                    description,
                    suggestedNextStep,
                    startSeconds,
                    endSeconds,
                    frequencyHz,
                });
            }

            evidenceData["findings"] = findingsList;
        }

        evidenceItems.Add(new EvidenceItem
        {
            EvidenceId = evidenceId,
            Type = "findings",
            Data = evidenceData,
        });
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

    private static void TryEmitBasicMetricsComparisonEvidence(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        var fileResults = new List<(string FileId, double Rms, double Peak, double CrestFactor)>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
                continue;
            var fileId = fileIdEl.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("metrics", out var metricsEl))
                continue;

            var rms = metricsEl.TryGetProperty("rmsDbFs", out var rmsEl) ? rmsEl.GetDouble() : double.NaN;
            var peak = metricsEl.TryGetProperty("peakDbFs", out var peakEl) ? peakEl.GetDouble() : double.NaN;
            var crest = metricsEl.TryGetProperty("crestFactorDb", out var crestEl) ? crestEl.GetDouble() : double.NaN;

            if (double.IsNaN(rms) || double.IsNaN(peak))
                continue;

            fileResults.Add((fileId, rms, peak, crest));
        }

        if (fileResults.Count < 2)
            return;

        var a = fileResults[0];
        var b = fileResults[1];

        var rmsDelta = Math.Round(b.Rms - a.Rms, 2);
        var peakDelta = Math.Round(b.Peak - a.Peak, 2);
        var crestDelta = Math.Round(b.CrestFactor - a.CrestFactor, 2);

        var evidenceId = "ev_level_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(new EvidenceItem
        {
            EvidenceId = evidenceId,
            Type = "level_comparison",
            Data = new Dictionary<string, object?>
            {
                ["type"] = "level_comparison",
                ["fileIdA"] = a.FileId,
                ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                ["fileIdB"] = b.FileId,
                ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                ["rmsADbFs"] = a.Rms,
                ["rmsBDbFs"] = b.Rms,
                ["rmsDeltaDb"] = rmsDelta,
                ["louderFileId"] = a.Rms >= b.Rms ? a.FileId : b.FileId,
                ["peakADbFs"] = a.Peak,
                ["peakBDbFs"] = b.Peak,
                ["peakDeltaDb"] = peakDelta,
                ["higherPeakFileId"] = a.Peak >= b.Peak ? a.FileId : b.FileId,
                ["crestFactorADb"] = a.CrestFactor,
                ["crestFactorBDb"] = b.CrestFactor,
                ["crestFactorDeltaDb"] = crestDelta,
                ["moreDynamicFileId"] = a.CrestFactor >= b.CrestFactor ? a.FileId : b.FileId,
            },
        });
    }

    private static void TryEmitSpectrumComparisonEvidence(
        JsonElement resultsArray,
        List<EvidenceItem> evidenceItems,
        Dictionary<string, string> fileIdToNameMap)
    {
        var fileResults = new List<(string FileId, double PeakFreq, double MaxMag, List<object?> Peaks)>();

        foreach (var fileResult in resultsArray.EnumerateArray())
        {
            if (!fileResult.TryGetProperty("fileId", out var fileIdEl))
                continue;
            var fileId = fileIdEl.GetString() ?? "unknown";

            if (!fileResult.TryGetProperty("summary", out var summaryEl))
                continue;

            var peakFreq = summaryEl.TryGetProperty("peakFrequencyHz", out var freqEl) ? freqEl.GetDouble() : double.NaN;
            var maxMag = summaryEl.TryGetProperty("maxMagnitudeDb", out var magEl) ? magEl.GetDouble() : double.NaN;

            if (double.IsNaN(peakFreq))
                continue;

            var peaks = new List<object?>();
            if (summaryEl.TryGetProperty("dominantPeaks", out var peaksArray))
            {
                foreach (var peak in peaksArray.EnumerateArray())
                {
                    var freqHz = peak.TryGetProperty("frequencyHz", out var f) ? f.GetDouble() : 0.0;
                    var magDb = peak.TryGetProperty("magnitudeDb", out var m) ? m.GetDouble() : 0.0;
                    peaks.Add(new { frequencyHz = freqHz, magnitudeDb = magDb });
                }
            }

            fileResults.Add((fileId, peakFreq, maxMag, peaks));
        }

        if (fileResults.Count < 2)
            return;

        var a = fileResults[0];
        var b = fileResults[1];

        var peakFreqDelta = Math.Round(b.PeakFreq - a.PeakFreq, 1);
        var maxMagDelta = Math.Round(b.MaxMag - a.MaxMag, 2);

        var evidenceId = "ev_spectrum_cmp_" + a.FileId[..Math.Min(a.FileId.Length, 8)];

        evidenceItems.Add(new EvidenceItem
        {
            EvidenceId = evidenceId,
            Type = "spectrum_comparison",
            Data = new Dictionary<string, object?>
            {
                ["type"] = "spectrum_comparison",
                ["fileIdA"] = a.FileId,
                ["fileNameA"] = fileIdToNameMap.GetValueOrDefault(a.FileId, a.FileId),
                ["fileIdB"] = b.FileId,
                ["fileNameB"] = fileIdToNameMap.GetValueOrDefault(b.FileId, b.FileId),
                ["peakFrequencyAHz"] = a.PeakFreq,
                ["peakFrequencyBHz"] = b.PeakFreq,
                ["peakFrequencyDeltaHz"] = peakFreqDelta,
                ["maxMagnitudeADb"] = a.MaxMag,
                ["maxMagnitudeBDb"] = b.MaxMag,
                ["maxMagnitudeDeltaDb"] = maxMagDelta,
                ["dominantPeaksA"] = a.Peaks,
                ["dominantPeaksB"] = b.Peaks,
            },
        });
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
