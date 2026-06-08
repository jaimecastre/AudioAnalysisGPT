using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public interface ICpbFilterBankClient
{
    Task<CpbAnalysis> AnalyzeAsync(
        RunCpbQuery query,
        IReadOnlyList<SignalChannel> channels,
        CancellationToken cancellationToken);
}
