namespace AcousticCanvas.Features.Agent.Orchestration;

public static class AgentEvidenceLookup
{
    public static bool TryFindEvidence(
        EvidencePackage evidencePackage,
        string evidenceId,
        out EvidenceItem evidence
    )
    {
        foreach (var item in evidencePackage.KeyEvidence)
        {
            if (string.Equals(item.EvidenceId, evidenceId, StringComparison.OrdinalIgnoreCase))
            {
                evidence = item;
                return true;
            }
        }

        evidence = null!;
        return false;
    }

    public static bool TryGetResultId(EvidenceItem evidence, out string resultId)
    {
        if (
            evidence.Data.TryGetValue("resultId", out var resultIdRaw)
            && resultIdRaw is string resultIdString
            && !string.IsNullOrWhiteSpace(resultIdString)
        )
        {
            resultId = resultIdString;
            return true;
        }

        resultId = string.Empty;
        return false;
    }

    public static EvidenceFileIdentity GetEvidenceFileIdentity(
        EvidenceItem evidence,
        string fallbackFileId,
        string fallbackFileName
    )
    {
        evidence.Data.TryGetValue("fileId", out var fileIdRaw);
        evidence.Data.TryGetValue("fileName", out var fileNameRaw);

        return new EvidenceFileIdentity(
            FileId: fileIdRaw as string ?? fallbackFileId,
            FileName: fileNameRaw as string ?? fallbackFileName
        );
    }
}

public sealed record EvidenceFileIdentity(string FileId, string FileName);
