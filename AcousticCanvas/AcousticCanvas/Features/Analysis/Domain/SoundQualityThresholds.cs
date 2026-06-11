namespace AcousticCanvas.Features.Analysis.Domain;

public static class SoundQualityThresholds
{
    public static class Loudness
    {
        public const double Good = 70.0;
        public const double Fair = 85.0;
    }

    public static class Sharpness
    {
        public const double Good = 2.0;
        public const double Fair = 4.0;
    }

    public static class Roughness
    {
        public const double Good = 0.5;
        public const double Fair = 1.0;
    }

    public static string Assess(double value, double good, double fair)
    {
        if (value <= good) return "Good";
        if (value <= fair) return "Fair";
        return "Poor";
    }

    public static string AssessLoudness(double value) => Assess(value, Loudness.Good, Loudness.Fair);
    public static string AssessSharpness(double value) => Assess(value, Sharpness.Good, Sharpness.Fair);
    public static string AssessRoughness(double value) => Assess(value, Roughness.Good, Roughness.Fair);
}
