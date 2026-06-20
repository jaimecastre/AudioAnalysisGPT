using System.Globalization;
using System.Text;
using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed record AgentReportResult(
    string Title,
    string MarkdownContent,
    DateTimeOffset GeneratedAtUtc,
    IReadOnlyList<string> SourceToolResultRefs
);

public static class AgentReportBuilder
{
    private const string Unavailable = "unavailable";

    public static AgentReportResult Build(
        string title,
        EvidencePackage evidencePackage,
        IReadOnlyList<string> sourceToolResultRefs
    )
    {
        var effectiveTitle = string.IsNullOrWhiteSpace(title)
            ? "Acoustic QA Report"
            : title.Trim();
        var generatedAtUtc = DateTimeOffset.UtcNow;
        var fileReports = BuildFileReports(evidencePackage);
        var markdown = BuildMarkdown(effectiveTitle, generatedAtUtc, evidencePackage, fileReports);

        return new AgentReportResult(
            Title: effectiveTitle,
            MarkdownContent: markdown,
            GeneratedAtUtc: generatedAtUtc,
            SourceToolResultRefs: sourceToolResultRefs
        );
    }

    private static List<FileReportEvidence> BuildFileReports(EvidencePackage evidencePackage)
    {
        var reports = new Dictionary<string, FileReportEvidence>(StringComparer.OrdinalIgnoreCase);

        foreach (var fileId in evidencePackage.SelectedFileIds)
        {
            reports[fileId] = new FileReportEvidence(fileId, fileId);
        }

        foreach (var evidence in evidencePackage.KeyEvidence)
        {
            var fileId = GetString(evidence.Data, "fileId");
            if (string.IsNullOrWhiteSpace(fileId))
            {
                continue;
            }

            if (!reports.TryGetValue(fileId, out var report))
            {
                report = new FileReportEvidence(fileId, fileId);
                reports[fileId] = report;
            }

            report.FileName = GetString(evidence.Data, "fileName") ?? report.FileName;

            if (evidence.Type == EvidenceTypes.Metadata)
            {
                report.DurationSeconds = GetDouble(evidence.Data, "durationSeconds");
                report.SampleRateHz = GetInt(evidence.Data, "sampleRateHz");
                report.Channels = GetInt(evidence.Data, "channels");
                report.BitDepth = GetInt(evidence.Data, "bitDepth");
            }
            else if (evidence.Type == EvidenceTypes.BasicMetrics)
            {
                report.RmsDbFs = GetDouble(evidence.Data, "rmsDbFs");
                report.PeakDbFs = GetDouble(evidence.Data, "peakDbFs");
                report.CrestFactorDb = GetDouble(evidence.Data, "crestFactorDb");
                report.LevelDbUnit = GetString(evidence.Data, "levelDbUnit") ?? "dBFS";
            }
            else if (evidence.Type == EvidenceTypes.Spectrum)
            {
                report.PeakFrequencyHz = GetDouble(evidence.Data, "peakFrequencyHz");
                report.MaxMagnitudeDb = GetDouble(evidence.Data, "maxMagnitudeDb");
            }
            else if (evidence.Type == EvidenceTypes.Cpb)
            {
                report.HighestBands = FormatHighestBands(evidence.Data);
            }
            else if (evidence.Type == EvidenceTypes.SoundQuality)
            {
                report.LoudnessSone = GetDouble(evidence.Data, "loudnessSone");
                report.SharpnessAcum = GetDouble(evidence.Data, "sharpnessAcum");
                report.RoughnessAsper = GetDouble(evidence.Data, "roughnessAsper");
            }
            else if (evidence.Type == EvidenceTypes.Findings)
            {
                report.FindingCount = GetInt(evidence.Data, "findingCount");
                report.Findings = FormatFindings(evidence.Data);
            }
        }

        var orderedReports = new List<FileReportEvidence>();
        foreach (var fileId in evidencePackage.SelectedFileIds)
        {
            if (reports.TryGetValue(fileId, out var report))
            {
                orderedReports.Add(report);
            }
        }

        return orderedReports;
    }

    private static string BuildMarkdown(
        string title,
        DateTimeOffset generatedAtUtc,
        EvidencePackage evidencePackage,
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        var markdown = new StringBuilder();

        markdown.AppendLine("# " + title);
        markdown.AppendLine();
        markdown.AppendLine(
            "Generated: " + generatedAtUtc.ToString("yyyy-MM-dd HH:mm:ss 'UTC'", CultureInfo.InvariantCulture)
        );
        markdown.AppendLine();
        markdown.AppendLine("## Summary");
        markdown.AppendLine();
        markdown.AppendLine(
            "- Files analyzed: " + fileReports.Count.ToString(CultureInfo.InvariantCulture)
        );
        markdown.AppendLine("- Evidence source: deterministic backend analysis outputs.");
        markdown.AppendLine(
            "- Calibration note: reported levels are relative/digital unless calibration metadata supports physical acoustic units."
        );
        markdown.AppendLine();

        AppendCrossFileComparison(markdown, fileReports);
        AppendBatchConclusion(markdown, fileReports);

        markdown.AppendLine("## Files Analyzed");
        markdown.AppendLine();
        foreach (var report in fileReports)
        {
            markdown.AppendLine("- " + report.FileName + " (" + report.FileId + ")");
            markdown.AppendLine("  - Duration: " + FormatSeconds(report.DurationSeconds));
            markdown.AppendLine("  - Sample rate: " + FormatInteger(report.SampleRateHz, "Hz"));
            markdown.AppendLine("  - Channels: " + FormatInteger(report.Channels, string.Empty));
            markdown.AppendLine("  - Bit depth: " + FormatInteger(report.BitDepth, "bit"));
        }
        markdown.AppendLine();

        markdown.AppendLine("## Measured Metrics");
        markdown.AppendLine();
        foreach (var report in fileReports)
        {
            markdown.AppendLine("### " + report.FileName);
            markdown.AppendLine();
            markdown.AppendLine("- RMS level: " + FormatLevel(report.RmsDbFs, report.LevelDbUnit));
            markdown.AppendLine("- Peak level: " + FormatLevel(report.PeakDbFs, report.LevelDbUnit));
            markdown.AppendLine("- Crest factor: " + FormatDb(report.CrestFactorDb));
            markdown.AppendLine("- Dominant spectrum peak: " + FormatHz(report.PeakFrequencyHz));
            markdown.AppendLine("- Spectrum peak magnitude: " + FormatLevel(report.MaxMagnitudeDb, report.LevelDbUnit));
            markdown.AppendLine("- Loudness: " + FormatMetric(report.LoudnessSone, "sone"));
            markdown.AppendLine("- Sharpness: " + FormatMetric(report.SharpnessAcum, "acum"));
            markdown.AppendLine("- Roughness: " + FormatMetric(report.RoughnessAsper, "asper"));
            markdown.AppendLine("- Strongest CPB bands: " + FormatJoined(report.HighestBands));
            markdown.AppendLine();
        }

        markdown.AppendLine("## Findings");
        markdown.AppendLine();
        foreach (var report in fileReports)
        {
            markdown.AppendLine("### " + report.FileName);
            markdown.AppendLine();
            markdown.AppendLine(
                "- Finding count: " + FormatNullableInteger(report.FindingCount)
            );
            if (report.Findings.Count == 0)
            {
                markdown.AppendLine("- No findings returned by the findings pipeline.");
            }
            else
            {
                foreach (var finding in report.Findings)
                {
                    markdown.AppendLine("- " + finding.FormattedText);
                }
            }
            markdown.AppendLine();
        }

        markdown.AppendLine("## Limitations");
        markdown.AppendLine();
        if (evidencePackage.Limitations.Count == 0)
        {
            markdown.AppendLine("- No additional limitations were reported by the analysis pipeline.");
        }
        else
        {
            foreach (var limitation in evidencePackage.Limitations)
            {
                markdown.AppendLine("- " + limitation);
            }
        }
        markdown.AppendLine();

        markdown.AppendLine("## Suggested Next Checks");
        markdown.AppendLine();
        var suggestedChecks = BuildSuggestedChecks(fileReports);
        foreach (var suggestedCheck in suggestedChecks)
        {
            markdown.AppendLine("- " + suggestedCheck);
        }

        return markdown.ToString().TrimEnd();
    }

    private static List<string> BuildSuggestedChecks(IReadOnlyList<FileReportEvidence> fileReports)
    {
        var checks = new List<string>();

        foreach (var report in fileReports)
        {
            foreach (var finding in report.Findings)
            {
                checks.Add(report.FileName + ": review finding - " + finding.FormattedText);
            }
        }

        if (checks.Count == 0)
        {
            checks.Add("Review the strongest spectrum and CPB regions if a subjective issue remains.");
        }

        return checks;
    }

    private static void AppendCrossFileComparison(
        StringBuilder markdown,
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        if (fileReports.Count < 2)
        {
            return;
        }

        markdown.AppendLine("## Cross-file Comparison");
        markdown.AppendLine();

        TryAppendHighestMetric(
            markdown,
            fileReports,
            "- Loudest by RMS",
            report => report.RmsDbFs,
            report => report.LevelDbUnit
        );
        TryAppendHighestMetric(
            markdown,
            fileReports,
            "- Highest peak",
            report => report.PeakDbFs,
            report => report.LevelDbUnit
        );
        TryAppendHighestMetric(
            markdown,
            fileReports,
            "- Loudest psychoacoustic file",
            report => report.LoudnessSone,
            _ => "sone"
        );
        TryAppendHighestMetric(
            markdown,
            fileReports,
            "- Sharpest file",
            report => report.SharpnessAcum,
            _ => "acum"
        );
        TryAppendHighestMetric(
            markdown,
            fileReports,
            "- Roughest file",
            report => report.RoughnessAsper,
            _ => "asper"
        );
        TryAppendMetricRange(
            markdown,
            fileReports,
            "- RMS range",
            report => report.RmsDbFs,
            report => report.LevelDbUnit
        );
        TryAppendMetricRange(
            markdown,
            fileReports,
            "- Peak range",
            report => report.PeakDbFs,
            report => report.LevelDbUnit
        );
        TryAppendMostFindings(markdown, fileReports);

        markdown.AppendLine();
        markdown.AppendLine("### Attention required");
        markdown.AppendLine();
        foreach (var attentionItem in BuildAttentionRequiredItems(fileReports))
        {
            markdown.AppendLine("- " + attentionItem);
        }
        markdown.AppendLine();
    }

    private static void AppendBatchConclusion(
        StringBuilder markdown,
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        if (fileReports.Count < 2)
        {
            return;
        }

        var candidates = BuildBatchConclusionCandidates(fileReports);
        markdown.AppendLine("## Batch Conclusion");
        markdown.AppendLine();

        if (candidates.Count == 0)
        {
            markdown.AppendLine(
                "- Batch conclusion unavailable: not enough comparable evidence across files."
            );
            markdown.AppendLine();
            return;
        }

        var lowestScore = candidates[0].AttentionScore;
        var highestScore = candidates[0].AttentionScore;
        foreach (var candidate in candidates)
        {
            if (candidate.AttentionScore < lowestScore)
            {
                lowestScore = candidate.AttentionScore;
            }

            if (candidate.AttentionScore > highestScore)
            {
                highestScore = candidate.AttentionScore;
            }
        }

        var bestReports = new List<FileReportEvidence>();
        var attentionReports = new List<FileReportEvidence>();
        foreach (var candidate in candidates)
        {
            if (candidate.AttentionScore == lowestScore)
            {
                bestReports.Add(candidate.Report);
            }

            if (candidate.AttentionScore == highestScore)
            {
                attentionReports.Add(candidate.Report);
            }
        }

        markdown.AppendLine(
            "- Best candidate for this QA batch: "
                + FormatReportNames(bestReports)
                + " - "
                + BuildBatchConclusionReason(bestReports, fileReports, isBestCandidate: true)
                + "."
        );
        markdown.AppendLine(
            "- Needs most attention: "
                + FormatReportNames(attentionReports)
                + " - "
                + BuildBatchConclusionReason(attentionReports, fileReports, isBestCandidate: false)
                + "."
        );
        markdown.AppendLine();
    }

    private static List<BatchConclusionCandidate> BuildBatchConclusionCandidates(
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        var hasComparableEvidence = false;
        var candidates = new List<BatchConclusionCandidate>();
        foreach (var report in fileReports)
        {
            candidates.Add(new BatchConclusionCandidate(report));
        }

        foreach (var candidate in candidates)
        {
            var findingScore = CalculateFindingAttentionScore(candidate.Report);
            if (findingScore > 0 || candidate.Report.FindingCount.HasValue)
            {
                hasComparableEvidence = true;
            }

            candidate.AttentionScore += findingScore;
        }

        hasComparableEvidence |= AddScoreToHighestReports(
            candidates,
            report => report.PeakDbFs,
            scoreToAdd: 2
        );
        hasComparableEvidence |= AddScoreToHighestReports(
            candidates,
            report => report.RmsDbFs,
            scoreToAdd: 1
        );
        hasComparableEvidence |= AddScoreToHighestReports(
            candidates,
            report => report.LoudnessSone,
            scoreToAdd: 1
        );
        hasComparableEvidence |= AddScoreToHighestReports(
            candidates,
            report => report.SharpnessAcum,
            scoreToAdd: 1
        );
        hasComparableEvidence |= AddScoreToHighestReports(
            candidates,
            report => report.RoughnessAsper,
            scoreToAdd: 1
        );

        return hasComparableEvidence ? candidates : [];
    }

    private static int CalculateFindingAttentionScore(FileReportEvidence report)
    {
        var score = 0;
        foreach (var finding in report.Findings)
        {
            score += GetFindingSeverityScore(finding.Severity);
        }

        if (score == 0 && report.FindingCount.HasValue)
        {
            score += report.FindingCount.Value;
        }

        return score;
    }

    private static int GetFindingSeverityScore(string severity)
    {
        if (severity.Equals("high", StringComparison.OrdinalIgnoreCase))
        {
            return 5;
        }

        if (severity.Equals("medium", StringComparison.OrdinalIgnoreCase))
        {
            return 3;
        }

        if (severity.Equals("low", StringComparison.OrdinalIgnoreCase))
        {
            return 1;
        }

        return 1;
    }

    private static bool AddScoreToHighestReports(
        IReadOnlyList<BatchConclusionCandidate> candidates,
        Func<FileReportEvidence, double?> valueSelector,
        int scoreToAdd
    )
    {
        double? highestValue = null;
        foreach (var candidate in candidates)
        {
            var value = valueSelector(candidate.Report);
            if (!value.HasValue)
            {
                continue;
            }

            if (!highestValue.HasValue || value.Value > highestValue.Value)
            {
                highestValue = value.Value;
            }
        }

        if (!highestValue.HasValue)
        {
            return false;
        }

        foreach (var candidate in candidates)
        {
            var value = valueSelector(candidate.Report);
            if (value.HasValue && value.Value.Equals(highestValue.Value))
            {
                candidate.AttentionScore += scoreToAdd;
            }
        }

        return true;
    }

    private static string BuildBatchConclusionReason(
        IReadOnlyList<FileReportEvidence> selectedReports,
        IReadOnlyList<FileReportEvidence> allReports,
        bool isBestCandidate
    )
    {
        var reasons = new List<string>();
        TryAddFindingReason(reasons, selectedReports, isBestCandidate);
        TryAddMetricReason(
            reasons,
            selectedReports,
            allReports,
            report => report.PeakDbFs,
            isBestCandidate ? "lowest peak level" : "highest peak level",
            isBestCandidate
        );
        TryAddMetricReason(
            reasons,
            selectedReports,
            allReports,
            report => report.RmsDbFs,
            isBestCandidate ? "quietest RMS level" : "loudest RMS level",
            isBestCandidate
        );
        TryAddMetricReason(
            reasons,
            selectedReports,
            allReports,
            report => report.LoudnessSone,
            isBestCandidate ? "lowest loudness" : "highest loudness",
            isBestCandidate
        );
        TryAddMetricReason(
            reasons,
            selectedReports,
            allReports,
            report => report.SharpnessAcum,
            isBestCandidate ? "lowest sharpness" : "highest sharpness",
            isBestCandidate
        );
        TryAddMetricReason(
            reasons,
            selectedReports,
            allReports,
            report => report.RoughnessAsper,
            isBestCandidate ? "lowest roughness" : "highest roughness",
            isBestCandidate
        );

        if (reasons.Count == 0)
        {
            reasons.Add("lowest overall attention score from available evidence");
        }

        return JoinConclusionReasons(reasons);
    }

    private static void TryAddFindingReason(
        List<string> reasons,
        IReadOnlyList<FileReportEvidence> selectedReports,
        bool isBestCandidate
    )
    {
        if (selectedReports.Count == 0)
        {
            return;
        }

        var highestSeverityRank = 0;
        var highestFindingCount = 0;
        var hasFindingEvidence = false;
        foreach (var report in selectedReports)
        {
            if (report.FindingCount.HasValue)
            {
                hasFindingEvidence = true;
                if (report.FindingCount.Value > highestFindingCount)
                {
                    highestFindingCount = report.FindingCount.Value;
                }
            }

            foreach (var finding in report.Findings)
            {
                hasFindingEvidence = true;
                var severityRank = GetFindingSeverityScore(finding.Severity);
                if (severityRank > highestSeverityRank)
                {
                    highestSeverityRank = severityRank;
                }
            }
        }

        if (!hasFindingEvidence)
        {
            return;
        }

        if (highestSeverityRank >= 5)
        {
            reasons.Add(isBestCandidate ? "lowest finding severity" : "high finding");
            return;
        }

        if (highestSeverityRank >= 3)
        {
            reasons.Add(isBestCandidate ? "lowest finding severity" : "medium finding");
            return;
        }

        if (highestSeverityRank >= 1)
        {
            reasons.Add(isBestCandidate ? "lowest finding severity" : "low finding");
            return;
        }

        if (highestFindingCount == 0)
        {
            reasons.Add("no findings");
        }
        else
        {
            reasons.Add(
                highestFindingCount.ToString(CultureInfo.InvariantCulture)
                    + (highestFindingCount == 1 ? " finding" : " findings")
            );
        }
    }

    private static void TryAddMetricReason(
        List<string> reasons,
        IReadOnlyList<FileReportEvidence> selectedReports,
        IReadOnlyList<FileReportEvidence> allReports,
        Func<FileReportEvidence, double?> valueSelector,
        string reason,
        bool useLowestValue
    )
    {
        if (reasons.Count >= 3)
        {
            return;
        }

        double? targetValue = null;
        foreach (var report in allReports)
        {
            var value = valueSelector(report);
            if (!value.HasValue)
            {
                continue;
            }

            if (!targetValue.HasValue)
            {
                targetValue = value.Value;
            }
            else if (useLowestValue && value.Value < targetValue.Value)
            {
                targetValue = value.Value;
            }
            else if (!useLowestValue && value.Value > targetValue.Value)
            {
                targetValue = value.Value;
            }
        }

        if (!targetValue.HasValue)
        {
            return;
        }

        foreach (var report in selectedReports)
        {
            var value = valueSelector(report);
            if (value.HasValue && value.Value.Equals(targetValue.Value))
            {
                reasons.Add(reason);
                return;
            }
        }
    }

    private static string JoinConclusionReasons(IReadOnlyList<string> reasons)
    {
        if (reasons.Count == 1)
        {
            return reasons[0];
        }

        if (reasons.Count == 2)
        {
            return reasons[0] + " and " + reasons[1];
        }

        return reasons[0] + ", " + reasons[1] + ", and " + reasons[2];
    }

    private static string FormatReportNames(IReadOnlyList<FileReportEvidence> reports)
    {
        return string.Join(", ", reports.Select(report => report.FileName));
    }

    private static void TryAppendHighestMetric(
        StringBuilder markdown,
        IReadOnlyList<FileReportEvidence> fileReports,
        string label,
        Func<FileReportEvidence, double?> valueSelector,
        Func<FileReportEvidence, string> unitSelector
    )
    {
        FileReportEvidence? highestReport = null;
        double? highestValue = null;

        foreach (var report in fileReports)
        {
            var value = valueSelector(report);
            if (!value.HasValue)
            {
                continue;
            }

            if (!highestValue.HasValue || value.Value > highestValue.Value)
            {
                highestReport = report;
                highestValue = value.Value;
            }
        }

        if (highestReport is null || !highestValue.HasValue)
        {
            return;
        }

        markdown.AppendLine(
            label
                + ": "
                + highestReport.FileName
                + " ("
                + FormatNumber(highestValue.Value, 2)
                + " "
                + unitSelector(highestReport)
                + ")"
        );
    }

    private static void TryAppendMetricRange(
        StringBuilder markdown,
        IReadOnlyList<FileReportEvidence> fileReports,
        string label,
        Func<FileReportEvidence, double?> valueSelector,
        Func<FileReportEvidence, string> unitSelector
    )
    {
        FileReportEvidence? lowestReport = null;
        FileReportEvidence? highestReport = null;
        double? lowestValue = null;
        double? highestValue = null;
        string? sharedUnit = null;
        var hasMixedUnits = false;

        foreach (var report in fileReports)
        {
            var value = valueSelector(report);
            if (!value.HasValue)
            {
                continue;
            }

            var unit = unitSelector(report);
            if (sharedUnit is null)
            {
                sharedUnit = unit;
            }
            else if (!sharedUnit.Equals(unit, StringComparison.OrdinalIgnoreCase))
            {
                hasMixedUnits = true;
            }

            if (!lowestValue.HasValue || value.Value < lowestValue.Value)
            {
                lowestReport = report;
                lowestValue = value.Value;
            }

            if (!highestValue.HasValue || value.Value > highestValue.Value)
            {
                highestReport = report;
                highestValue = value.Value;
            }
        }

        if (hasMixedUnits)
        {
            markdown.AppendLine("- Level range skipped because files use mixed level units.");
            return;
        }

        if (
            lowestReport is null
            || highestReport is null
            || !lowestValue.HasValue
            || !highestValue.HasValue
            || sharedUnit is null
        )
        {
            return;
        }

        var range = highestValue.Value - lowestValue.Value;
        markdown.AppendLine(
            label
                + ": "
                + FormatNumber(range, 2)
                + " "
                + sharedUnit
                + " from "
                + lowestReport.FileName
                + " to "
                + highestReport.FileName
        );
    }

    private static void TryAppendMostFindings(
        StringBuilder markdown,
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        int? highestFindingCount = null;

        foreach (var report in fileReports)
        {
            if (!report.FindingCount.HasValue)
            {
                continue;
            }

            if (
                !highestFindingCount.HasValue
                || report.FindingCount.Value > highestFindingCount.Value
            )
            {
                highestFindingCount = report.FindingCount.Value;
            }
        }

        if (!highestFindingCount.HasValue)
        {
            return;
        }

        var tiedReports = new List<FileReportEvidence>();
        foreach (var report in fileReports)
        {
            if (report.FindingCount == highestFindingCount)
            {
                tiedReports.Add(report);
            }
        }

        var fileNames = string.Join(", ", tiedReports.Select(report => report.FileName));
        var suffix = tiedReports.Count > 1 ? " each" : string.Empty;

        markdown.AppendLine(
            "- Most findings: "
                + fileNames
                + " ("
                + highestFindingCount.Value.ToString(CultureInfo.InvariantCulture)
                + suffix
                + ")"
        );
    }

    private static List<string> BuildAttentionRequiredItems(
        IReadOnlyList<FileReportEvidence> fileReports
    )
    {
        var highItems = new List<string>();
        var mediumItems = new List<string>();
        var lowItems = new List<string>();

        foreach (var report in fileReports)
        {
            foreach (var finding in report.Findings)
            {
                var item = report.FileName + ": " + finding.AttentionText;
                if (finding.Severity.Equals("high", StringComparison.OrdinalIgnoreCase))
                {
                    highItems.Add(item);
                }
                else if (finding.Severity.Equals("medium", StringComparison.OrdinalIgnoreCase))
                {
                    mediumItems.Add(item);
                }
                else
                {
                    lowItems.Add(item);
                }
            }
        }

        var items = new List<string>();
        items.AddRange(highItems);
        items.AddRange(mediumItems);
        items.AddRange(lowItems);

        if (items.Count == 0)
        {
            items.Add(
                "No file-level findings require immediate attention from the current evidence."
            );
        }

        return items;
    }

    private static List<string> FormatHighestBands(Dictionary<string, object?> evidenceData)
    {
        if (!evidenceData.TryGetValue("highestBands", out var rawBands) || rawBands is null)
        {
            return [];
        }

        var bands = ToJsonElementArray(rawBands);
        var formatted = new List<string>();
        foreach (var band in bands)
        {
            var label = TryGetString(band, "label") ?? FormatHz(TryGetDouble(band, "centerFrequencyHz"));
            var level = FormatLevel(TryGetDouble(band, "levelDb"), "dB SPL");
            formatted.Add(label + " (" + level + ")");
        }

        return formatted;
    }

    private static List<ReportFindingEvidence> FormatFindings(
        Dictionary<string, object?> evidenceData
    )
    {
        if (!evidenceData.TryGetValue("findings", out var rawFindings) || rawFindings is null)
        {
            return [];
        }

        var findings = ToJsonElementArray(rawFindings);
        var formatted = new List<ReportFindingEvidence>();

        foreach (var finding in findings)
        {
            var severity = TryGetString(finding, "severity") ?? "Unknown";
            var title = TryGetString(finding, "title") ?? "Untitled finding";
            var description = TryGetString(finding, "description");
            var suggestedNextStep = TryGetString(finding, "suggestedNextStep");
            var startSeconds = TryGetDouble(finding, "startSeconds");
            var endSeconds = TryGetDouble(finding, "endSeconds");

            var line = "[" + severity + "] " + title;
            if (!string.IsNullOrWhiteSpace(description))
            {
                line += " - " + description;
            }
            if (startSeconds.HasValue || endSeconds.HasValue)
            {
                line += " (" + FormatSeconds(startSeconds) + " to " + FormatSeconds(endSeconds) + ")";
            }
            if (!string.IsNullOrWhiteSpace(suggestedNextStep))
            {
                line += ". Next: " + suggestedNextStep;
            }

            var attentionText = BuildAttentionFindingSummary(
                severity,
                title,
                description,
                startSeconds,
                endSeconds
            );

            formatted.Add(new ReportFindingEvidence(severity, line, attentionText));
        }

        return formatted;
    }

    private static string BuildAttentionFindingSummary(
        string severity,
        string title,
        string? description,
        double? startSeconds,
        double? endSeconds
    )
    {
        var summary = severity.ToLowerInvariant() + " " + title.ToLowerInvariant();
        var frequencyHz = ExtractFrequencyHz(description);
        if (frequencyHz.HasValue)
        {
            summary += " at " + FormatAttentionHz(frequencyHz.Value);
        }

        if (startSeconds.HasValue || endSeconds.HasValue)
        {
            summary += " (" + FormatSeconds(startSeconds) + " to " + FormatSeconds(endSeconds) + ")";
        }

        return summary + ".";
    }

    private static string FormatAttentionHz(double frequencyHz)
    {
        var decimals = Math.Abs(frequencyHz - Math.Round(frequencyHz)) < 0.05 ? 0 : 1;
        return FormatNumber(frequencyHz, decimals) + " Hz";
    }

    private static double? ExtractFrequencyHz(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var hzIndex = text.IndexOf(" Hz", StringComparison.OrdinalIgnoreCase);
        if (hzIndex <= 0)
        {
            return null;
        }

        var startIndex = hzIndex - 1;
        while (startIndex >= 0)
        {
            var character = text[startIndex];
            if (!char.IsDigit(character) && character != '.')
            {
                break;
            }

            startIndex--;
        }

        var numberText = text[(startIndex + 1)..hzIndex];
        return double.TryParse(numberText, CultureInfo.InvariantCulture, out var frequencyHz)
            ? frequencyHz
            : null;
    }

    private static List<JsonElement> ToJsonElementArray(object rawValue)
    {
        var serialized = JsonSerializer.Serialize(rawValue);
        using var document = JsonDocument.Parse(serialized);
        if (document.RootElement.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var values = new List<JsonElement>();
        foreach (var element in document.RootElement.EnumerateArray())
        {
            values.Add(element.Clone());
        }

        return values;
    }

    private static string FormatJoined(IReadOnlyList<string> values)
    {
        return values.Count == 0 ? Unavailable : string.Join(", ", values);
    }

    private static string FormatSeconds(double? value)
    {
        return value.HasValue ? FormatNumber(value.Value, 3) + " s" : Unavailable;
    }

    private static string FormatHz(double? value)
    {
        return value.HasValue ? FormatNumber(value.Value, 0) + " Hz" : Unavailable;
    }

    private static string FormatDb(double? value)
    {
        return value.HasValue ? FormatNumber(value.Value, 2) + " dB" : Unavailable;
    }

    private static string FormatLevel(double? value, string? unit)
    {
        return value.HasValue
            ? FormatNumber(value.Value, 2) + " " + (string.IsNullOrWhiteSpace(unit) ? "dBFS" : unit)
            : Unavailable;
    }

    private static string FormatMetric(double? value, string unit)
    {
        return value.HasValue ? FormatNumber(value.Value, 2) + " " + unit : Unavailable;
    }

    private static string FormatInteger(int? value, string unit)
    {
        if (!value.HasValue)
        {
            return Unavailable;
        }

        var formattedValue = value.Value.ToString(CultureInfo.InvariantCulture);
        return string.IsNullOrWhiteSpace(unit) ? formattedValue : formattedValue + " " + unit;
    }

    private static string FormatNullableInteger(int? value)
    {
        return value.HasValue ? value.Value.ToString(CultureInfo.InvariantCulture) : Unavailable;
    }

    private static string FormatNumber(double value, int decimals)
    {
        return value.ToString("F" + decimals, CultureInfo.InvariantCulture);
    }

    private static string? GetString(Dictionary<string, object?> data, string key)
    {
        return data.TryGetValue(key, out var value) ? value?.ToString() : null;
    }

    private static double? GetDouble(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var value) || value is null)
        {
            return null;
        }

        if (value is double doubleValue)
        {
            return doubleValue;
        }

        if (value is float floatValue)
        {
            return floatValue;
        }

        if (value is int intValue)
        {
            return intValue;
        }

        return double.TryParse(value.ToString(), CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static int? GetInt(Dictionary<string, object?> data, string key)
    {
        if (!data.TryGetValue(key, out var value) || value is null)
        {
            return null;
        }

        if (value is int intValue)
        {
            return intValue;
        }

        return int.TryParse(value.ToString(), CultureInfo.InvariantCulture, out var parsed)
            ? parsed
            : null;
    }

    private static string? TryGetString(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        return property.ValueKind == JsonValueKind.Null ? null : property.GetString();
    }

    private static double? TryGetDouble(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Null)
        {
            return null;
        }

        return property.TryGetDouble(out var value) ? value : null;
    }

    private sealed class FileReportEvidence(string fileId, string fileName)
    {
        public string FileId { get; } = fileId;
        public string FileName { get; set; } = fileName;
        public double? DurationSeconds { get; set; }
        public int? SampleRateHz { get; set; }
        public int? Channels { get; set; }
        public int? BitDepth { get; set; }
        public double? RmsDbFs { get; set; }
        public double? PeakDbFs { get; set; }
        public double? CrestFactorDb { get; set; }
        public string LevelDbUnit { get; set; } = "dBFS";
        public double? PeakFrequencyHz { get; set; }
        public double? MaxMagnitudeDb { get; set; }
        public double? LoudnessSone { get; set; }
        public double? SharpnessAcum { get; set; }
        public double? RoughnessAsper { get; set; }
        public int? FindingCount { get; set; }
        public List<string> HighestBands { get; set; } = [];
        public List<ReportFindingEvidence> Findings { get; set; } = [];
    }

    private sealed record ReportFindingEvidence(
        string Severity,
        string FormattedText,
        string AttentionText
    );

    private sealed class BatchConclusionCandidate(FileReportEvidence report)
    {
        public FileReportEvidence Report { get; } = report;
        public int AttentionScore { get; set; }
    }
}
