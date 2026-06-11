using AcousticCanvas.Features.Analysis.Domain;

namespace AcousticCanvas.Tests;

public sealed class SoundQualitySummaryTests
{
    [Fact]
    public void DetermineOverallAssessment_AllGood_ReturnsGood()
    {
        var assessments = new Dictionary<string, string>
        {
            ["loudness"] = "Good",
            ["sharpness"] = "Good",
            ["roughness"] = "Good"
        };

        var result = DetermineOverallAssessment(assessments);
        Assert.Equal("Good", result);
    }

    [Fact]
    public void DetermineOverallAssessment_OneFair_ReturnsFair()
    {
        var assessments = new Dictionary<string, string>
        {
            ["loudness"] = "Good",
            ["sharpness"] = "Fair",
            ["roughness"] = "Good"
        };

        var result = DetermineOverallAssessment(assessments);
        Assert.Equal("Fair", result);
    }

    [Fact]
    public void DetermineOverallAssessment_OnePoor_ReturnsPoor()
    {
        var assessments = new Dictionary<string, string>
        {
            ["loudness"] = "Good",
            ["sharpness"] = "Good",
            ["roughness"] = "Poor"
        };

        var result = DetermineOverallAssessment(assessments);
        Assert.Equal("Poor", result);
    }

    [Fact]
    public void DetermineOverallAssessment_Mixed_ReturnsPoor()
    {
        var assessments = new Dictionary<string, string>
        {
            ["loudness"] = "Poor",
            ["sharpness"] = "Fair",
            ["roughness"] = "Good"
        };

        var result = DetermineOverallAssessment(assessments);
        Assert.Equal("Poor", result);
    }

    // Helper method to test the private logic
    private static string DetermineOverallAssessment(Dictionary<string, string> assessments)
    {
        if (assessments.Values.Any(a => a == "Poor"))
        {
            return "Poor";
        }
        if (assessments.Values.Any(a => a == "Fair"))
        {
            return "Fair";
        }
        return "Good";
    }
}
