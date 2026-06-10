using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class AgentMetaQuestionRouterTests
{
    [Theory]
    [InlineData("why did you analyse both?")]
    [InlineData("why did you analyze both files")]
    [InlineData("why are you analysing all files?")]
    public void RoutesWhyBothFilesQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("selected file list", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("@filename", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void DoesNotRouteActualAudioQuestion()
    {
        var answer = AgentMetaQuestionRouter.TryAnswer("why does this file sound harsh?");

        Assert.Null(answer);
    }
}
