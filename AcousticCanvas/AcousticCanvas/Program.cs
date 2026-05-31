using FastEndpoints;
using AcousticCanvas.Features.AudioUpload.Handlers;
using AcousticCanvas.Features.Playback.Handlers;
using AcousticCanvas.Features.Playback.Services;
using AcousticCanvas.Features.Waveform.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddFastEndpoints();
builder.Services.AddSingleton<UploadAudioHandler>();
builder.Services.AddSingleton<WaveformAnalyzer>();
builder.Services.AddSingleton<PlaybackStateStore>();
builder.Services.AddSingleton<PlaybackControlHandler>();
builder.Services.AddSingleton<GetPlaybackStateHandler>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:5174")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new() { Title = "AcousticCanvas", Version = "v1" });
});

var app = builder.Build();

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

