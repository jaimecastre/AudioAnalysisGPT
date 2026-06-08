using AcousticCanvas.Features.Analysis.Analyzers;
using AcousticCanvas.Features.Analysis.Commands;
using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Features.Analysis.Services;

public sealed class CpbAnalysisService(ICpbFilterBankClient filterBankClient)
{
    public Task<CpbAnalysis> AnalyzeAsync(
        RunCpbQuery query,
        IReadOnlyList<SignalChannel> channels,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var method = NormalizeMethod(query.Method);
        if (method == "python_filter_bank")
        {
            return filterBankClient.AnalyzeAsync(query, channels, cancellationToken);
        }

        var result = CpbAnalyzer.Analyze(
            channels,
            query.StartSeconds,
            query.EndSeconds,
            query.BandMode,
            query.FftSize,
            query.Overlap,
            query.Weighting);

        return Task.FromResult(result);
    }

    private static string NormalizeMethod(string method)
    {
        return method.Equals("python_filter_bank", StringComparison.OrdinalIgnoreCase)
            ? "python_filter_bank"
            : "fft_bin_power_sum";
    }
}
