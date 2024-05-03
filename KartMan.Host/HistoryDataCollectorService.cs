using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.Sqlite;

namespace KartMan.Host;

public sealed record ShortEntry(
    int lap, decimal time);

public sealed record LapEntry(
    DateTime recordedAtUtc,
    int session,
    string totalLength,
    string kart,
    int lap,
    decimal time)
{
    public ComparisonEntry ToComparisonEntry() => new(DateOnly.FromDateTime(recordedAtUtc), session, kart, lap);
}

public sealed record RawJson(
    RawHeadInfo headinfo,
    object[][] results);

public sealed record RawHeadInfo(
    string number,
    string len);

public sealed class HistoryDataRepository
{
    private const string DbConnectionString = "Data Source=data.db";
    public const decimal FastestAllowedTime = 0; // This setting is futile, there will always be skewed times.
    private readonly HashSet<ComparisonEntry> _cache = new HashSet<ComparisonEntry>();

    public async Task<IEnumerable<LapEntry>> GetHistoryForDayAsync(DateOnly day)
    {
        using (var connection = new SqliteConnection(DbConnectionString))
        {
            await connection.OpenAsync();

            var command = connection.CreateCommand();
            command.CommandText =
            @"
                SELECT day, recorded_at_utc, session, total_length, kart, lap, time
                FROM data
                WHERE day = $date
            ";
            command.Parameters.AddWithValue("$date", day);

            var list = new List<LapEntry>();
            using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var recordedAtUtc = reader.GetDateTime(1);
                    var session = reader.GetInt32(2);
                    var totalLength = reader.GetString(3);
                    var kart = reader.GetString(4);
                    var lap = reader.GetInt32(5);
                    var time = reader.GetDecimal(6);

                    list.Add(new LapEntry(
                        recordedAtUtc,
                        session,
                        totalLength,
                        kart,
                        lap,
                        time));
                }
            }

            return list;
        }
    }

    public async Task<IEnumerable<LapEntry>> GetTopTimesAsync(int top)
    {
        using (var connection = new SqliteConnection(DbConnectionString))
        {
            await connection.OpenAsync();

            var command = connection.CreateCommand();
            command.CommandText =
            @"
                SELECT day, recorded_at_utc, session, total_length, kart, lap, time
                FROM data
                ORDER BY time
                LIMIT $top
            ";
            command.Parameters.AddWithValue("$top", top);

            var list = new List<LapEntry>();
            using (var reader = await command.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                {
                    var recordedAtUtc = reader.GetDateTime(1);
                    var session = reader.GetInt32(2);
                    var totalLength = reader.GetString(3);
                    var kart = reader.GetString(4);
                    var lap = reader.GetInt32(5);
                    var time = reader.GetDecimal(6);

                    list.Add(new LapEntry(
                        recordedAtUtc,
                        session,
                        totalLength,
                        kart,
                        lap,
                        time));
                }
            }

            return list;
        }
    }

    public async Task SaveLapAsync(DateOnly day, LapEntry entry)
    {
        if (entry.time < FastestAllowedTime)
            return;

        if (_cache.Contains(entry.ToComparisonEntry()))
            return;

        using (var connection = new SqliteConnection(DbConnectionString))
        {
            await connection.OpenAsync();

            var command = connection.CreateCommand();
            command.CommandText =
            @"
                INSERT OR IGNORE INTO data (day, recorded_at_utc, session, total_length, kart, lap, time)
                VALUES (DATE($recordedAtUtc), $recordedAtUtc, $session, $totalLength, $kart, $lap, $time)
            ";
            command.Parameters.AddWithValue("$recordedAtUtc", entry.recordedAtUtc);
            command.Parameters.AddWithValue("$session", entry.session);
            command.Parameters.AddWithValue("$totalLength", entry.totalLength);
            command.Parameters.AddWithValue("$kart", entry.kart);
            command.Parameters.AddWithValue("$lap", entry.lap);
            command.Parameters.AddWithValue("$time", entry.time);

            await command.ExecuteNonQueryAsync();
        }

        _cache.Add(entry.ToComparisonEntry());
    }
}

public sealed record ComparisonEntry(DateOnly day, int session, string kart, int lap);
public sealed class HistoryDataCollectorService : IHostedService
{
    private bool _isRunning = true;
    private Task _gatheringData;
    private readonly HistoryDataRepository _repository;
    private readonly HttpClient _http = new HttpClient();
    private string _previousHash;
    private static readonly int StartTimeHourUtc = 5; // 9 AM.
    private static readonly int EndTimeHourUtc = 19; // 11 PM.
    private DateTime _lastTelemetryRecordedAtUtc;
    private string _lastSession;
    private bool _dayEnded = false;

    public HistoryDataCollectorService(HistoryDataRepository repository)
    {
        _repository = repository;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _gatheringData = Task.Run(async () =>
        {
            while (true)
            {
                if ((DateTime.UtcNow.Hour < StartTimeHourUtc || DateTime.UtcNow.Hour >= EndTimeHourUtc)
                    && DateTime.UtcNow - _lastTelemetryRecordedAtUtc > TimeSpan.FromHours(1.5))
                {
                    _dayEnded = true;
                    await Task.Delay(TimeSpan.FromMinutes(5));
                    continue;
                }

                if (!_isRunning)
                    return;

                await GatherDataAsync();

                await Task.Delay(3000);
            }
        });

        Console.WriteLine("Started gathering history data.");
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        Console.WriteLine("Stopped gathering history data.");
        _isRunning = false;
        return Task.CompletedTask;
    }

    private async Task GatherDataAsync()
    {
        try
        {
            var response = await _http.GetAsync("https://kart-timer.com/drivers/ajax.php?p=livescreen&track=110&target=updaterace");
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync();

            var hash = Encoding.UTF8.GetString(MD5.HashData(Encoding.UTF8.GetBytes(content)));
            if (_previousHash == hash)
                return;
            _previousHash = hash;
            _lastTelemetryRecordedAtUtc = DateTime.UtcNow;

            var rawJson = JsonSerializer.Deserialize<RawJson>(content);
            // TODO: Send signalr update here to update the web page, we got new data.

            if (_dayEnded && _lastSession == rawJson.headinfo.number)
                return; // TODO: If there were ZERO sessions for the whole day - this will cause first session of the next day to be lost. Try to fix this.

            if (_dayEnded) _dayEnded = false;

            _lastSession = rawJson.headinfo.number;

            var entries = rawJson.results.Select(x =>
            {
                var time = x[6]?.ToString();
                if (string.IsNullOrEmpty(time) || !decimal.TryParse(time, out var _)) return null;

                try
                {
                    return new LapEntry(
                        DateTime.UtcNow,
                        Convert.ToInt32(rawJson.headinfo.number),
                        rawJson.headinfo.len,
                        x[2].ToString(),
                        Convert.ToInt32(x[3].ToString()),
                        Convert.ToDecimal(time));
                }
                catch (Exception exception)
                {
                    Console.WriteLine($"{DateTime.UtcNow} Error when trying to parse data for lap entry: {exception.Message}, {exception.StackTrace}, {exception.InnerException?.Message}");
                    return null;
                }
            }).Where(x => x != null).ToList();

            foreach (var entry in entries)
            {
                await _repository.SaveLapAsync(DateOnly.FromDateTime(DateTime.UtcNow), entry);
            }
        }
        catch (Exception exception)
        {
            Console.WriteLine($"{DateTime.UtcNow} Error when trying to gather data: {exception.Message}, {exception.StackTrace}, {exception.InnerException?.Message}");
        }
    }
}
