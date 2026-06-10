using FastEndpoints;
using AcousticCanvas.Features.Analysis.Commands;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunBatchBenchmarkHandler : CommandHandler<RunBatchBenchmarkCommand, BatchBenchmarkResult>
{
    public override async Task<BatchBenchmarkResult> ExecuteAsync(RunBatchBenchmarkCommand command, CancellationToken ct)
    {
        ct.ThrowIfCancellationRequested();

        if (command.FilePaths.Count < 2)
        {
            throw new ArgumentException("At least two files are required for benchmarking.");
        }

        if (command.FileIds.Count != command.FilePaths.Count)
        {
            throw new ArgumentException("Benchmark fileIds and filePaths must have matching counts.");
        }

        var compareCommand = new RunCompareCommand(
            FilePaths: command.FilePaths,
            StartSeconds: command.StartSeconds,
            EndSeconds: command.EndSeconds);

        var compareResult = await compareCommand.ExecuteAsync(ct);
        var sources = new List<BatchBenchmarkSource>();

        for (int index = 0; index < command.FilePaths.Count; index++)
        {
            ct.ThrowIfCancellationRequested();

            var filePath = command.FilePaths[index];
            var summary = compareResult.Files[index];
            var findingsCommand = new RunFindingsCommand(FilePath: filePath);
            var findingsResult = await findingsCommand.ExecuteAsync(ct);
            sources.Add(new BatchBenchmarkSource(summary, findingsResult.Findings, command.FileIds[index]));
        }

        var result = BatchBenchmarkBuilder.Build(sources, DateTimeOffset.UtcNow);

        if (command.StartSeconds.HasValue || command.EndSeconds.HasValue)
        {
            var limitations = result.Limitations.ToList();
            limitations.Add("Level, spectrum, and sound-quality metrics use the selected region; findings counts are evaluated over full files in this version.");
            return result with { Limitations = limitations };
        }

        return result;
    }
}
