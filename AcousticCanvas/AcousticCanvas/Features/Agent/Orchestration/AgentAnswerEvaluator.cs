using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace AcousticCanvas.Features.Agent.Orchestration;

public sealed record AgentAnswerEvalCase
{
    public required string Id { get; init; }
    public required string Question { get; init; }
    public required EvidencePackage EvidencePackage { get; init; }
    public required FinalAnswerResponse FinalAnswer { get; init; }
    public IReadOnlyList<string> ExpectedEvidenceRefs { get; init; } = [];
    public IReadOnlyList<string> MustContain { get; init; } = [];
    public IReadOnlyList<string> MustNotContain { get; init; } = [];
    public IReadOnlyList<string> RequiredUnits { get; init; } = [];
    public IReadOnlyList<string> AllowedClaims { get; init; } = [];
    public IReadOnlyList<string> ForbiddenClaims { get; init; } = [];
    public string? ExpectedConfidence { get; init; }
    public IReadOnlyList<string> ExpectedLimitations { get; init; } = [];
}

public sealed record AgentAnswerEvaluationResult
{
    public required string CaseId { get; init; }
    public required bool Passed { get; init; }
    public required IReadOnlyList<string> Failures { get; init; }
}

public static class AgentAnswerEvaluator
{
    private static readonly Regex MeasurementRegex = new(
        @"(?<value>-?\d+(?:\.\d+)?)\s*(?<unit>dB\s*SPL|dBFS|dB|kHz|Hz|sone|acum|asper|LUFS)\b",
        RegexOptions.IgnoreCase | RegexOptions.Compiled
    );

    private static readonly string[] UnsupportedCausePhrases =
    [
        "caused by",
        "due to",
        "because of",
        "motor bearing",
        "bearing fault",
        "electrical fault",
        "mechanical fault",
        "rpm",
    ];

    public static AgentAnswerEvaluationResult Evaluate(AgentAnswerEvalCase evalCase)
    {
        var failures = new List<string>();
        var answer = evalCase.FinalAnswer.Answer;

        CheckRequiredText(evalCase, answer, failures);
        CheckEvidenceReferences(evalCase, failures);
        CheckNumericGrounding(evalCase, answer, failures);
        CheckLimitations(evalCase, answer, failures);
        CheckConfidence(evalCase, failures);
        CheckForbiddenClaims(evalCase, answer, failures);
        CheckUnsupportedCausality(evalCase, answer, failures);

        return new AgentAnswerEvaluationResult
        {
            CaseId = evalCase.Id,
            Passed = failures.Count == 0,
            Failures = failures,
        };
    }

    private static void CheckRequiredText(
        AgentAnswerEvalCase evalCase,
        string answer,
        List<string> failures
    )
    {
        foreach (var requiredText in evalCase.MustContain)
        {
            if (!ContainsIgnoreCase(answer, requiredText))
            {
                failures.Add($"Answer must contain '{requiredText}'.");
            }
        }

        foreach (var forbiddenText in evalCase.MustNotContain)
        {
            if (ContainsIgnoreCase(answer, forbiddenText))
            {
                failures.Add($"Answer must not contain '{forbiddenText}'.");
            }
        }

        foreach (var requiredUnit in evalCase.RequiredUnits)
        {
            if (!ContainsIgnoreCase(answer, requiredUnit))
            {
                failures.Add($"Answer must include required unit '{requiredUnit}'.");
            }
        }
    }

    private static void CheckEvidenceReferences(AgentAnswerEvalCase evalCase, List<string> failures)
    {
        var availableEvidenceIds = new HashSet<string>(
            evalCase.EvidencePackage.KeyEvidence.Select(item => item.EvidenceId),
            StringComparer.OrdinalIgnoreCase
        );

        foreach (var referencedId in evalCase.FinalAnswer.EvidenceReferences)
        {
            if (!availableEvidenceIds.Contains(referencedId))
            {
                failures.Add($"Answer referenced unknown evidence ID '{referencedId}'.");
            }
        }

        foreach (var expectedEvidenceRef in evalCase.ExpectedEvidenceRefs)
        {
            if (!evalCase.FinalAnswer.EvidenceReferences.Contains(expectedEvidenceRef))
            {
                failures.Add(
                    $"Answer did not reference expected evidence ID '{expectedEvidenceRef}'."
                );
            }
        }
    }

    private static void CheckNumericGrounding(
        AgentAnswerEvalCase evalCase,
        string answer,
        List<string> failures
    )
    {
        var evidenceMeasurements = ExtractEvidenceMeasurements(evalCase.EvidencePackage);
        var answerMeasurements = ExtractAnswerMeasurements(answer);

        foreach (var answerMeasurement in answerMeasurements)
        {
            var matchesEvidence = evidenceMeasurements.Any(evidenceMeasurement =>
                evidenceMeasurement.Unit == answerMeasurement.Unit
                && Math.Abs(evidenceMeasurement.Value - answerMeasurement.Value)
                    <= GetTolerance(answerMeasurement.Unit)
            );

            if (!matchesEvidence)
            {
                failures.Add(
                    $"Answer measurement {FormatMeasurement(answerMeasurement)} is not grounded in evidence."
                );
            }
        }
    }

    private static void CheckLimitations(
        AgentAnswerEvalCase evalCase,
        string answer,
        List<string> failures
    )
    {
        foreach (var expectedLimitation in evalCase.ExpectedLimitations)
        {
            if (!AnswerOrLimitationsContain(evalCase.FinalAnswer, answer, expectedLimitation))
            {
                failures.Add($"Answer did not include expected limitation '{expectedLimitation}'.");
            }
        }

        foreach (var evidenceLimitation in evalCase.EvidencePackage.Limitations)
        {
            if (!AnswerOrLimitationsContain(evalCase.FinalAnswer, answer, evidenceLimitation))
            {
                failures.Add(
                    $"Answer did not propagate evidence limitation '{evidenceLimitation}'."
                );
            }
        }
    }

    private static void CheckConfidence(AgentAnswerEvalCase evalCase, List<string> failures)
    {
        if (string.IsNullOrWhiteSpace(evalCase.ExpectedConfidence))
        {
            return;
        }

        var actualRank = GetConfidenceRank(evalCase.FinalAnswer.Confidence);
        var expectedRank = GetConfidenceRank(evalCase.ExpectedConfidence);
        if (actualRank > expectedRank)
        {
            failures.Add(
                $"Answer confidence '{evalCase.FinalAnswer.Confidence}' is higher than expected '{evalCase.ExpectedConfidence}'."
            );
        }
    }

    private static void CheckForbiddenClaims(
        AgentAnswerEvalCase evalCase,
        string answer,
        List<string> failures
    )
    {
        foreach (var forbiddenClaim in evalCase.ForbiddenClaims)
        {
            if (
                ContainsIgnoreCase(answer, forbiddenClaim)
                && !IsAllowedClaim(evalCase, forbiddenClaim)
            )
            {
                failures.Add($"Answer contains forbidden claim '{forbiddenClaim}'.");
            }
        }
    }

    private static void CheckUnsupportedCausality(
        AgentAnswerEvalCase evalCase,
        string answer,
        List<string> failures
    )
    {
        foreach (var unsupportedPhrase in UnsupportedCausePhrases)
        {
            if (
                ContainsIgnoreCase(answer, unsupportedPhrase)
                && !IsAllowedClaim(evalCase, unsupportedPhrase)
            )
            {
                failures.Add(
                    $"Answer contains unsupported causal claim marker '{unsupportedPhrase}'."
                );
            }
        }
    }

    private static bool AnswerOrLimitationsContain(
        FinalAnswerResponse finalAnswer,
        string answer,
        string expectedText
    )
    {
        if (ContainsIgnoreCase(answer, expectedText))
        {
            return true;
        }

        return finalAnswer.Limitations.Any(limitation =>
            ContainsIgnoreCase(limitation, expectedText)
            || ContainsIgnoreCase(expectedText, limitation)
        );
    }

    private static bool IsAllowedClaim(AgentAnswerEvalCase evalCase, string claim)
    {
        return evalCase.AllowedClaims.Any(allowedClaim =>
            ContainsIgnoreCase(claim, allowedClaim) || ContainsIgnoreCase(allowedClaim, claim)
        );
    }

    private static List<Measurement> ExtractAnswerMeasurements(string answer)
    {
        var measurements = new List<Measurement>();
        foreach (Match match in MeasurementRegex.Matches(answer))
        {
            var value = double.Parse(match.Groups["value"].Value, CultureInfo.InvariantCulture);
            var unit = NormalizeUnit(match.Groups["unit"].Value);
            if (
                unit == "Hz"
                && match.Groups["unit"].Value.Equals("kHz", StringComparison.OrdinalIgnoreCase)
            )
            {
                value *= 1000.0;
            }
            measurements.Add(new Measurement(value, unit));
        }
        return measurements;
    }

    private static List<Measurement> ExtractEvidenceMeasurements(EvidencePackage evidencePackage)
    {
        var measurements = new List<Measurement>();

        foreach (var evidenceItem in evidencePackage.KeyEvidence)
        {
            foreach (var pair in evidenceItem.Data)
            {
                AddEvidenceMeasurements(pair.Key, pair.Value, measurements);
            }
        }

        AddPairwiseDifferences(measurements);
        return measurements;
    }

    private static void AddEvidenceMeasurements(
        string key,
        object? rawValue,
        List<Measurement> measurements
    )
    {
        if (rawValue is null)
        {
            return;
        }

        if (rawValue is JsonElement jsonElement)
        {
            AddJsonElementMeasurements(key, jsonElement, measurements);
            return;
        }

        if (rawValue is Dictionary<string, object?> dictionary)
        {
            foreach (var pair in dictionary)
            {
                AddEvidenceMeasurements(pair.Key, pair.Value, measurements);
            }
            return;
        }

        var unit = InferUnitFromKey(key);
        if (unit is null)
        {
            return;
        }

        if (TryConvertToDouble(rawValue, out var numericValue))
        {
            measurements.Add(new Measurement(numericValue, unit));
        }
    }

    private static void AddJsonElementMeasurements(
        string key,
        JsonElement jsonElement,
        List<Measurement> measurements
    )
    {
        if (jsonElement.ValueKind == JsonValueKind.Number)
        {
            var unit = InferUnitFromKey(key);
            if (unit is not null && jsonElement.TryGetDouble(out var numericValue))
            {
                measurements.Add(new Measurement(numericValue, unit));
            }
            return;
        }

        if (jsonElement.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in jsonElement.EnumerateObject())
            {
                AddJsonElementMeasurements(property.Name, property.Value, measurements);
            }
        }
    }

    private static void AddPairwiseDifferences(List<Measurement> measurements)
    {
        var originals = measurements.ToList();
        for (var firstIndex = 0; firstIndex < originals.Count; firstIndex++)
        {
            for (var secondIndex = firstIndex + 1; secondIndex < originals.Count; secondIndex++)
            {
                var first = originals[firstIndex];
                var second = originals[secondIndex];
                if (first.Unit != second.Unit)
                {
                    continue;
                }

                measurements.Add(new Measurement(Math.Abs(first.Value - second.Value), first.Unit));
            }
        }
    }

    private static string? InferUnitFromKey(string key)
    {
        if (key.Contains("hz", StringComparison.OrdinalIgnoreCase))
        {
            return "Hz";
        }

        if (key.Contains("sone", StringComparison.OrdinalIgnoreCase))
        {
            return "sone";
        }

        if (key.Contains("acum", StringComparison.OrdinalIgnoreCase))
        {
            return "acum";
        }

        if (key.Contains("asper", StringComparison.OrdinalIgnoreCase))
        {
            return "asper";
        }

        if (key.Contains("db", StringComparison.OrdinalIgnoreCase))
        {
            return "dB";
        }

        return null;
    }

    private static bool TryConvertToDouble(object rawValue, out double value)
    {
        try
        {
            value = Convert.ToDouble(rawValue, CultureInfo.InvariantCulture);
            return true;
        }
        catch
        {
            value = 0.0;
            return false;
        }
    }

    private static string NormalizeUnit(string rawUnit)
    {
        var compact = rawUnit.Replace(" ", string.Empty).ToLowerInvariant();
        return compact switch
        {
            "dbspl" => "dB",
            "dbfs" => "dB",
            "db" => "dB",
            "hz" => "Hz",
            "khz" => "Hz",
            "sone" => "sone",
            "acum" => "acum",
            "asper" => "asper",
            "lufs" => "LUFS",
            _ => rawUnit,
        };
    }

    private static double GetTolerance(string unit)
    {
        return unit switch
        {
            "Hz" => 1.0,
            "dB" => 0.1,
            "sone" => 0.01,
            "acum" => 0.01,
            "asper" => 0.01,
            _ => 0.0001,
        };
    }

    private static int GetConfidenceRank(string confidence)
    {
        return confidence.ToLowerInvariant() switch
        {
            "low" => 1,
            "medium" => 2,
            "high" => 3,
            _ => 3,
        };
    }

    private static bool ContainsIgnoreCase(string text, string value)
    {
        return text.Contains(value, StringComparison.OrdinalIgnoreCase);
    }

    private static string FormatMeasurement(Measurement measurement)
    {
        return $"{measurement.Value.ToString("0.###", CultureInfo.InvariantCulture)} {measurement.Unit}";
    }

    private sealed record Measurement(double Value, string Unit);
}
