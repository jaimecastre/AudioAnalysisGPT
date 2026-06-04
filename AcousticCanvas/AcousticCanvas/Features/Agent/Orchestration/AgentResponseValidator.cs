namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentResponseValidator
{
    public static ValidationResult Validate(
        FinalAnswerResponse finalAnswer,
        EvidencePackage evidencePackage)
    {
        var availableEvidenceIds = new HashSet<string>(
            evidencePackage.KeyEvidence.Select(e => e.EvidenceId),
            StringComparer.OrdinalIgnoreCase);

        var answerIsEmpty = string.IsNullOrWhiteSpace(finalAnswer.Answer);
        if (answerIsEmpty)
        {
            return new ValidationResult
            {
                IsAcceptable = false,
                HasWarning = true,
                WarningReason = "Agent returned an empty answer.",
            };
        }

        var hasNoEvidenceReferences = finalAnswer.EvidenceReferences.Count == 0;
        if (hasNoEvidenceReferences && evidencePackage.KeyEvidence.Count > 0)
        {
            return new ValidationResult
            {
                IsAcceptable = true,
                HasWarning = true,
                WarningReason = "Agent answer does not reference any evidence IDs despite evidence being available.",
            };
        }

        var referencedIdsNotInPackage = finalAnswer.EvidenceReferences
            .Where(refId => !availableEvidenceIds.Contains(refId))
            .ToList();

        if (referencedIdsNotInPackage.Count > 0)
        {
            return new ValidationResult
            {
                IsAcceptable = true,
                HasWarning = true,
                WarningReason = $"Agent referenced evidence IDs not found in the package: {string.Join(", ", referencedIdsNotInPackage)}.",
            };
        }

        var hasNoLimitationsWhenEvidenceIsPartial = finalAnswer.Limitations.Count == 0
            && evidencePackage.Limitations.Count > 0;

        if (hasNoLimitationsWhenEvidenceIsPartial)
        {
            return new ValidationResult
            {
                IsAcceptable = true,
                HasWarning = true,
                WarningReason = "Agent did not include limitations despite the evidence package containing known limitations.",
            };
        }

        return new ValidationResult
        {
            IsAcceptable = true,
            HasWarning = false,
        };
    }
}
