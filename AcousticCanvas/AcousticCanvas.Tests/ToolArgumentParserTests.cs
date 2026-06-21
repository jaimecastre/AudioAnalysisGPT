using AcousticCanvas.Features.Agent.Orchestration;

namespace AcousticCanvas.Tests;

public sealed class ToolArgumentParserTests
{
    [Fact]
    public void ExtractIntArgumentReadsPlainDotNetNumberTypes()
    {
        var arguments = new Dictionary<string, object?>
        {
            ["intValue"] = 2048,
            ["longValue"] = 4096L,
            ["wholeDoubleValue"] = 8192.0,
        };

        Assert.Equal(2048, ToolArgumentParser.ExtractIntArgument(arguments, "intValue"));
        Assert.Equal(4096, ToolArgumentParser.ExtractIntArgument(arguments, "longValue"));
        Assert.Equal(8192, ToolArgumentParser.ExtractIntArgument(arguments, "wholeDoubleValue"));
    }

    [Fact]
    public void ExtractIntArgumentRejectsNonWholeOrOutOfRangeNumbers()
    {
        var arguments = new Dictionary<string, object?>
        {
            ["fractionalDoubleValue"] = 1024.5,
            ["outOfRangeLongValue"] = (long)int.MaxValue + 1,
        };

        Assert.Null(ToolArgumentParser.ExtractIntArgument(arguments, "fractionalDoubleValue"));
        Assert.Null(ToolArgumentParser.ExtractIntArgument(arguments, "outOfRangeLongValue"));
    }
}
