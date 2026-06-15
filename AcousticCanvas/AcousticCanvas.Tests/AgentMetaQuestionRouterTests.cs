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

    [Fact]
    public void RoutesSpectrumSplQuestionToCalibrationLimitation()
    {
        var answer = AgentMetaQuestionRouter.TryAnswer("What is the SPL of the spectral peak?");

        Assert.NotNull(answer);
        Assert.Contains("dB SPL", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("0 dBFS", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What is an FFT spectrum?")]
    [InlineData("Explain FFT spectrum")]
    [InlineData("Define frequency spectrum")]
    public void RoutesSpectrumDefinitionQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("frequency", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("dominant", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What does CPB mean?")]
    [InlineData("What is octave band analysis?")]
    [InlineData("Explain 1/3 octave")]
    public void RoutesCpbDefinitionQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("constant-percentage", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("octave", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void RoutesCpbSplQuestionToCalibrationLimitation()
    {
        var answer = AgentMetaQuestionRouter.TryAnswer("What is the SPL of the CPB band?");

        Assert.NotNull(answer);
        Assert.Contains("dB SPL", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("0 dBFS", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What is roughness?")]
    [InlineData("What is sharpness?")]
    [InlineData("Explain psychoacoustic loudness")]
    [InlineData("What does sound quality mean?")]
    public void RoutesSoundQualityDefinitionQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("psychoacoustic", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("sone", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("asper", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("Can you convert sone to LUFS?")]
    [InlineData("What SPL is implied by roughness?")]
    [InlineData("How much dB gain change is 10 sone?")]
    public void RoutesUnsupportedSoundQualityConversionQuestionToNoToolAnswer(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.NotNull(answer);
        Assert.Contains("cannot be converted", answer!, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("LUFS", answer!, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData("What causes the 257 Hz peak?")]
    [InlineData("Is there energy around 1 kHz in @file.wav?")]
    public void DoesNotRouteSpectrumMeasurementQuestionsAsDefinitions(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }

    [Theory]
    [InlineData("Run CPB @file.wav")]
    [InlineData("Which octave band is strongest in @file.wav?")]
    public void DoesNotRouteCpbMeasurementQuestionsAsDefinitions(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }

    [Theory]
    [InlineData("What is the loudness of @file.wav?")]
    [InlineData("What is the loudness?")]
    [InlineData("What is the loudness and roughness?")]
    [InlineData("Compare roughness of @a.wav and @b.wav")]
    [InlineData("Measure sound quality for this file")]
    public void DoesNotRouteSoundQualityMeasurementQuestionsAsDefinitions(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }

    [Theory]
    [InlineData("What causes this band in the spectrogram?")]
    [InlineData("Is there energy near 1 kHz throughout the file?")]
    public void DoesNotRouteSpectrogramMeasurementQuestionsAsDefinitions(string question)
    {
        var answer = AgentMetaQuestionRouter.TryAnswer(question);

        Assert.Null(answer);
    }
}
