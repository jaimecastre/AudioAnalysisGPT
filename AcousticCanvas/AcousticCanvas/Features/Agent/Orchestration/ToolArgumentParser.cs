using System.Text.Json;

namespace AcousticCanvas.Features.Agent.Orchestration;

public static class ToolArgumentParser
{
    public static List<string> ExtractFileIds(Dictionary<string, object?> arguments)
    {
        if (!arguments.TryGetValue("fileIds", out var rawFileIds))
        {
            return [];
        }

        if (rawFileIds is JsonElement jsonElement)
        {
            if (jsonElement.ValueKind == JsonValueKind.Array)
            {
                var fileIds = new List<string>();
                foreach (var item in jsonElement.EnumerateArray())
                {
                    var stringValue = item.GetString();
                    if (!string.IsNullOrWhiteSpace(stringValue))
                    {
                        fileIds.Add(stringValue.Trim());
                    }
                }
                return fileIds;
            }

            if (jsonElement.ValueKind == JsonValueKind.String)
            {
                var commaSeparated = jsonElement.GetString() ?? string.Empty;
                return SplitCommaSeparatedIds(commaSeparated);
            }
        }

        if (rawFileIds is IEnumerable<string> stringList)
        {
            var fileIds = new List<string>();
            foreach (var item in stringList)
            {
                if (!string.IsNullOrWhiteSpace(item))
                {
                    fileIds.Add(item.Trim());
                }
            }
            return fileIds;
        }

        if (rawFileIds is string rawString)
        {
            return SplitCommaSeparatedIds(rawString);
        }

        return [];
    }

    public static string? ExtractSingleFileId(Dictionary<string, object?> arguments)
    {
        if (!arguments.TryGetValue("fileId", out var rawFileId))
        {
            return null;
        }

        if (rawFileId is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.String)
        {
            return jsonElement.GetString();
        }

        return rawFileId?.ToString();
    }

    public static string? ExtractStringArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (rawValue is JsonElement jsonElement && jsonElement.ValueKind == JsonValueKind.String)
        {
            return jsonElement.GetString();
        }

        return rawValue?.ToString();
    }

    public static int? ExtractIntArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (
            rawValue is JsonElement jsonElement
            && jsonElement.ValueKind == JsonValueKind.Number
            && jsonElement.TryGetInt32(out var intValue)
        )
        {
            return intValue;
        }

        return null;
    }

    public static double? ExtractDoubleArgument(Dictionary<string, object?> arguments, string key)
    {
        if (!arguments.TryGetValue(key, out var rawValue))
        {
            return null;
        }

        if (
            rawValue is JsonElement jsonElement
            && jsonElement.ValueKind == JsonValueKind.Number
            && jsonElement.TryGetDouble(out var doubleValue)
        )
        {
            return doubleValue;
        }

        return null;
    }

    private static List<string> SplitCommaSeparatedIds(string commaSeparated)
    {
        var result = new List<string>();
        foreach (
            var part in commaSeparated.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
        )
        {
            if (!string.IsNullOrWhiteSpace(part))
            {
                result.Add(part);
            }
        }
        return result;
    }
}
