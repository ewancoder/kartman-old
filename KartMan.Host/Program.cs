using KartMan.Host;
using Microsoft.AspNetCore.Cors.Infrastructure;

var builder = WebApplication.CreateBuilder();
builder.Services.AddHostedService<HistoryDataCollectorService>();
builder.Services.AddSingleton<HistoryDataRepository>();

builder.Services.AddCors(x =>
{
    x.AddPolicy("Cors", x => x
        .WithOrigins("http://localhost:4200", "https://kartman.typingrealm.com")
        .AllowAnyMethod()
        .AllowAnyHeader()
        .AllowCredentials());
});

var app = builder.Build();

var repository = app.Services.GetRequiredService<HistoryDataRepository>();

app.MapGet("/api/history/today", async () =>
{
    var history = await repository.GetHistoryForDayAsync(DateOnly.FromDateTime(DateTime.UtcNow));

    return history;
});

app.MapGet("/api/history/{session}/{kart}", async (int session, string kart) =>
{
    var history = (await repository.GetHistoryForDayAsync(DateOnly.FromDateTime(DateTime.UtcNow)))
        .Where(x => x.session == session && x.kart == kart)
        .Select(x => new ShortEntry(x.lap, x.time))
        .ToList();

    return history;
});

app.MapGet("/api/history/top10", async () =>
{
    return await repository.GetTopTimesAsync(10);
});

app.MapGet("/api/history/{dateString}", async (string dateString) =>
{
    var date = DateTime.ParseExact(dateString, "dd-MM-yyyy", null);
    var history = await repository.GetHistoryForDayAsync(DateOnly.FromDateTime(date));

    return history;
});

app.UseCors("Cors");

await app.RunAsync();
