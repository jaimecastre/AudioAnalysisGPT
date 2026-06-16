using System.Text.Json;
using System.Text.Json.Serialization;
using AcousticCanvas.Features.Agent.Handlers;
using AcousticCanvas.Features.Agent.Orchestration;
using AcousticCanvas.Features.Agent.Services;
using AcousticCanvas.Features.Analysis.Handlers;
using AcousticCanvas.Features.Analysis.Importers;
using AcousticCanvas.Features.Analysis.Services;
using AcousticCanvas.Features.AudioUpload.Handlers;
using AcousticCanvas.Features.AudioUpload.Services;
using AcousticCanvas.Features.Playback.Handlers;
using AcousticCanvas.Features.Playback.Services;
using AcousticCanvas.Features.Waveform.Handlers;
using FastEndpoints;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddFastEndpoints();
builder.Services.Configure<Microsoft.AspNetCore.Http.Json.JsonOptions>(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddSingleton<AudioFileRepository>();
builder.Services.AddSingleton<UploadAudioHandler>();
var importers = new List<ISignalFileImporter> { new WavSignalFileImporter() };
builder.Services.AddSingleton<IReadOnlyList<ISignalFileImporter>>(importers);
builder.Services.AddSingleton<SignalFileCacheStore>();
builder.Services.AddSingleton<SignalAnalysisService>();
builder.Services.AddSingleton<RunAnalysisHandler>();
builder.Services.AddSingleton<RunAgentAnalysisHandler>();
builder.Services.AddSingleton<RunSpectrumHandler>();
builder.Services.AddSingleton<SpectrogramCacheStore>();
builder.Services.AddSingleton<RunSpectrogramHandler>();
builder.Services.AddSingleton<ICpbFilterBankClient, PythonCpbFilterBankClient>();
builder.Services.AddSingleton<CpbAnalysisService>();
builder.Services.AddSingleton<RunCpbHandler>();
builder.Services.AddSingleton<PythonSoundQualityPool>(sp =>
{
    var config = sp.GetRequiredService<IConfiguration>();
    return new PythonSoundQualityPool(config, poolSize: 2);
});
builder.Services.AddSingleton<ISoundQualityClient>(sp => sp.GetRequiredService<PythonSoundQualityPool>());
builder.Services.AddSingleton<SoundQualityCacheStore>();
builder.Services.AddSingleton<SoundQualityAnalysisService>();
builder.Services.AddSingleton<RunSoundQualityHandler>();
builder.Services.AddSingleton<MetricRankingHandler>();
builder.Services.AddSingleton<SoundQualitySummaryHandler>();
builder.Services.AddSingleton<RunCompareHandler>();
builder.Services.AddSingleton<RunBatchBenchmarkHandler>();
builder.Services.AddSingleton<FindEventsHandler>();
builder.Services.AddSingleton<RunFindingsHandler>();
builder.Services.AddSingleton<GetWaveformHandler>();
builder.Services.AddSingleton<AnalysisResultCache>();
builder.Services.AddSingleton<PlaybackStateStore>();
builder.Services.AddSingleton<PlaybackControlHandler>();
builder.Services.AddSingleton<GetPlaybackStateHandler>();
builder.Services.AddSingleton<OpenAiChatService>();
builder.Services.AddSingleton<AgentPlanner>();
builder.Services.AddSingleton<ToolExecutionService>();
builder.Services.AddSingleton<IInvestigationTraceStore, InvestigationTraceStore>();
builder.Services.AddSingleton<AgentOrchestrator>();
builder.Services.AddSingleton<AgentAskHandler>();

builder.Services.AddCors(options =>
{
    options.AddPolicy(
        "AllowFrontend",
        policy =>
        {
            policy
                .WithOrigins("http://localhost:5173", "http://localhost:5174")
                .AllowAnyHeader()
                .AllowAnyMethod();
        }
    );
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AcousticCanvas", Version = "v1" });
});

// Initialize Python process pool
var app = builder.Build();
var pool = app.Services.GetRequiredService<PythonSoundQualityPool>();
try
{
    await pool.InitializeAsync();
    Console.WriteLine("Python sound quality process pool initialized (2 workers).");
}
catch (Exception ex)
{
    Console.WriteLine($"Warning: Failed to initialize Python sound quality pool: {ex.Message}");
    Console.WriteLine("Sound quality analysis will use fallback single-process mode.");
}
// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();

app.UseCors("AllowFrontend");
app.UseFastEndpoints();
app.Run();
