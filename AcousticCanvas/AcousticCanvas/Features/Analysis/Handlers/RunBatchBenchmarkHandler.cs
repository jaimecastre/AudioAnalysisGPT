using AcousticCanvas.Features.Analysis.Commands;
using FastEndpoints;

namespace AcousticCanvas.Features.Analysis.Handlers;

public class RunBatchBenchmarkHandler
    : CommandHandler<RunBatchBenchmarkCommand, BatchBenchmarkResult>
{
    public override async Task<BatchBenchmarkResult> ExecuteAsync(
        RunBatchBenchmarkCommand command,
        CancellationToken ct
    )
    {
        ct.ThrowIfCancellationRequested();

        if (command.FilePaths.Count < 2)
        {
            throw new ArgumentException("At least two files are required for benchmarking.");
        }

        if (command.FileIds.Count != command.FilePaths.Count)
        {
            throw new ArgumentException(
                "Benchmark fileIds and filePaths must have matching counts."
            );
        }

        var compareCommand = new RunCompareCommand(
            FilePaths: command.FilePaths,
            StartSeconds: command.StartSeconds,
            EndSeconds: command.EndSeconds
        );

        var compareTask = compareCommand.ExecuteAsync(ct);
        var findingsTasks = command
            .FilePaths.Select(filePath =>
                new RunFindingsCommand(FilePath: filePath).ExecuteAsync(ct)
            )
            .ToArray();

        var compareResult = await compareTask;
        var findingsResults = await Task.WhenAll(findingsTasks);

        var sources = command
            .FilePaths.Select(
                (filePath, index) =>
                    new BatchBenchmarkSource(
                        compareResult.Files[index],
                        findingsResults[index].Findings,
                        command.FileIds[index]
                    )
            )
            .ToList();

        var result = BatchBenchmarkBuilder.Build(sources, DateTimeOffset.UtcNow);

        if (command.StartSeconds.HasValue || command.EndSeconds.HasValue)
        {
            var limitations = result.Limitations.ToList();
            limitations.Add(
                "Level, spectrum, and sound-quality metrics use the selected region; findings counts are evaluated over full files in this version."
            );
            return result with { Limitations = limitations };
        }

        return result;
    }
}
