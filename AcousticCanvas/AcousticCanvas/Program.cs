using FastEndpoints;
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddFastEndpoints();


builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

//app.UseHttpsRedirection();

app.UseFastEndpoints();
app.Run();

