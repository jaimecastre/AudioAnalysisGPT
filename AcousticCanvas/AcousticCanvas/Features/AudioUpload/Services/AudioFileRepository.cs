namespace AcousticCanvas.Features.AudioUpload.Services;

public class AudioFileRepository
{
    private readonly string _storagePath;

    public AudioFileRepository()
    {
        _storagePath = Path.Combine(Directory.GetCurrentDirectory(), "AudioStorage");
        Directory.CreateDirectory(_storagePath);
    }

    public string SaveFile(string fileId, string fileName, Stream fileStream)
    {
        var storedFileName = $"{fileId}_{fileName}";
        var storagePath = Path.Combine(_storagePath, storedFileName);

        using var fileOutput = File.Create(storagePath);
        fileStream.CopyTo(fileOutput);

        return storagePath;
    }

    public string GetFilePath(string fileId)
    {
        var files = Directory.GetFiles(_storagePath, $"{fileId}_*");
        return files.FirstOrDefault() ?? string.Empty;
    }

    public string GetOriginalFileName(string fileId)
    {
        var files = Directory.GetFiles(_storagePath, $"{fileId}_*");
        var filePath = files.FirstOrDefault();
        if (string.IsNullOrEmpty(filePath))
        {
            return string.Empty;
        }

        var fileName = Path.GetFileName(filePath);
        // Remove the fileId_ prefix
        if (fileName.StartsWith($"{fileId}_"))
        {
            return fileName.Substring(fileId.Length + 1);
        }

        return fileName;
    }
}
