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

    [Theory]
    [InlineData("What is a spectrogram?")]
    [InlineData("Explain spectrogram")]
    [InlineData("Define spectrogram")]
    public void RoutesSpectrogramDefinitionQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("time-frequency", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("time", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("frequency", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What does the spectrogram show for @file.wav?")]
    [InlineData("Show me the spectrogram for this file")]
    public void DoesNotRouteSpectrogramDataQuestion(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }

    [Theory]
    [InlineData("Click Spectrogram evidence pill")]
    [InlineData("Inspect workspace card")]
    public void RoutesWorkspaceUiInstructionsToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("UI action", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("right workspace", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RoutesSpectrogramSplQuestionToCalibrationLimitation()
    {
        var answer = AgentMetaQuestionRouter.TryAnswer("What is the SPL in the spectrogram?");

        Assert.NotNull(answer);
        Assert.Contains("does not report SPL", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("calibration", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What causes this band in the spectrogram?")]
    [InlineData("Is there energy near 1 kHz throughout the file?")]
    public void DoesNotRouteSpectrogramMeasurementQuestionsAsDefinitions(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }

    [Theory]
    [InlineData("What is the peak level of this file?")]
    [InlineData("Show me the spectrogram")]
    [InlineData("Analyze the frequency content")]
    [InlineData("Does this file have clipping?")]
    [InlineData("What's the RMS level?")]
    public void AppearsToBeAudioAnalysisQuestionDetectsAudioQuestions(string question)
    {
        var result = AcousticCanvas.Features.Agent.Orchestration.AgentOrchestrator.TestAppearsToBeAudioAnalysisQuestion(question);

        Assert.True(result);
    }

    [Theory]
    [InlineData("Hello")]
    [InlineData("How are you?")]
    [InlineData("What time is it?")]
    public void AppearsToBeAudioAnalysisQuestionRejectsNonAudioQuestions(string question)
    {
        var result = AcousticCanvas.Features.Agent.Orchestration.AgentOrchestrator.TestAppearsToBeAudioAnalysisQuestion(question);

        Assert.False(result);
    }
}
