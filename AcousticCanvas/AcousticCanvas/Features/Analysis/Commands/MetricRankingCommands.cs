using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Commands;

public record MetricRankingRequest(
    IReadOnlyList<string> FileIds,
    IReadOnlyList<string> Metrics) : ICommand<MetricRankingResult>;

public record MetricRankingResult(
    IReadOnlyList<MetricRankingRow> Rankings);

public record MetricRankingRow(
    string FileId,
    string FileName,
    string MetricName,
    double Value,
    string Unit,
    int Rank);
