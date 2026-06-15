using System.Runtime.CompilerServices;
using AcousticCanvas.Features.Agent.Orchestration;
using AcousticCanvas.Features.Agent.Services;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Services;
using AcousticCanvas.Features.Playback.Services;
using FastEndpoints;
using Microsoft.Extensions.DependencyInjection;

namespace AcousticCanvas.Tests;

public static class FastEndpointsModuleInitializer
{
    [ModuleInitializer]
    public static void Initialize()
    {
        Factory.RegisterTestServices(RegisterAppServices);
    }

    private static void RegisterAppServices(IServiceCollection services)
    {
        services.AddServicesForUnitTesting();
        services.AddSingleton<AudioFileRepository>();
        var importers = new List<ISignalFileImporter> { new WavSignalFileImporter() };
        services.AddSingleton<IReadOnlyList<ISignalFileImporter>>(importers);
        services.AddSingleton<SignalFileCacheStore>();
        services.AddSingleton<SignalAnalysisService>();
        services.AddSingleton<SpectrogramCacheStore>();
        services.AddSingleton<ICpbFilterBankClient, PythonCpbFilterBankClient>();
        services.AddSingleton<CpbAnalysisService>();
        services.AddSingleton<ISoundQualityClient, PythonSoundQualityClient>();
        services.AddSingleton<SoundQualityCacheStore>();
        services.AddSingleton<SoundQualityAnalysisService>();
        services.AddSingleton<AnalysisResultCache>();
        services.AddSingleton<PlaybackStateStore>();
        services.AddSingleton<OpenAiChatService>();
        services.AddSingleton<AgentPlanner>();
        services.AddSingleton<ToolExecutionService>();
        services.AddSingleton<IInvestigationTraceStore, InvestigationTraceStore>();
        services.AddSingleton<AgentOrchestrator>();
    }
}
