using System.Text;
using System.Text.Json;
using System.Threading.Channels;

namespace Sightline.Core;

public sealed record DiagnosticFileOptions(
    string DirectoryPath,
    int QueueCapacity = 256,
    long MaxFileBytes = 2 * 1024 * 1024,
    int MaxFiles = 3,
    int MaxDetailChars = 1000)
{
    public void Validate()
    {
        if (string.IsNullOrWhiteSpace(DirectoryPath))
            throw new ArgumentException("Diagnostic directory is required.", nameof(DirectoryPath));
        if (QueueCapacity is < 16 or > 4096)
            throw new ArgumentOutOfRangeException(nameof(QueueCapacity));
        if (MaxFileBytes is < 4096 or > 64L * 1024 * 1024)
            throw new ArgumentOutOfRangeException(nameof(MaxFileBytes));
        if (MaxFiles is < 1 or > 10)
            throw new ArgumentOutOfRangeException(nameof(MaxFiles));
        if (MaxDetailChars is < 64 or > 16_384)
            throw new ArgumentOutOfRangeException(nameof(MaxDetailChars));
        if (MaxFileBytes < (long)MaxDetailChars * 4 + 2048)
            throw new ArgumentException("MaxFileBytes must accommodate one bounded UTF-8 diagnostic event.", nameof(MaxFileBytes));
    }
}

public sealed class BoundedDiagnosticFileSink : IAsyncDisposable
{
    private sealed class WriterState
    {
        public WriterState(StreamWriter writer, long length)
        {
            Writer = writer;
            Length = length;
        }

        public StreamWriter Writer { get; }
        public long Length { get; set; }
    }

    private readonly DiagnosticFileOptions _options;
    private readonly Channel<DiagnosticEvent> _channel;
    private readonly Task _worker;
    private readonly object _statusGate = new();
    private long _droppedEvents;
    private string? _lastFailure;

    public BoundedDiagnosticFileSink(DiagnosticFileOptions options)
    {
        _options = options ?? throw new ArgumentNullException(nameof(options));
        _options.Validate();

        _channel = Channel.CreateBounded<DiagnosticEvent>(new BoundedChannelOptions(_options.QueueCapacity)
        {
            SingleReader = true,
            SingleWriter = false,
            FullMode = BoundedChannelFullMode.Wait,
            AllowSynchronousContinuations = false
        });
        _worker = ProcessAsync();
    }

    public int QueueCapacity => _options.QueueCapacity;
    public long DroppedEvents => Interlocked.Read(ref _droppedEvents);

    public string? LastFailure
    {
        get { lock (_statusGate) return _lastFailure; }
    }

    public bool TryWrite(DiagnosticEvent item)
    {
        ArgumentNullException.ThrowIfNull(item);

        try
        {
            var sanitized = DiagnosticSanitizer.Sanitize(item, _options.MaxDetailChars);
            if (_channel.Writer.TryWrite(sanitized))
                return true;
        }
        catch
        {
            // Diagnostics are best-effort and must never fail the application.
        }

        Interlocked.Increment(ref _droppedEvents);
        return false;
    }

    public async ValueTask DisposeAsync()
    {
        _channel.Writer.TryComplete();
        try { await _worker.ConfigureAwait(false); }
        catch { }
    }

    private async Task ProcessAsync()
    {
        WriterState? state = null;
        try
        {
            Directory.CreateDirectory(_options.DirectoryPath);

            await foreach (var first in _channel.Reader.ReadAllAsync().ConfigureAwait(false))
            {
                state = await WriteEventAsync(state, first).ConfigureAwait(false);

                var batchCount = 1;
                while (batchCount < 32 && _channel.Reader.TryRead(out var next))
                {
                    state = await WriteEventAsync(state, next).ConfigureAwait(false);
                    batchCount++;
                }

                await state.Writer.FlushAsync().ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            lock (_statusGate)
                _lastFailure = $"{ex.GetType().Name}: {ex.Message}".Trim().Truncate(512);

            _channel.Writer.TryComplete();
            while (_channel.Reader.TryRead(out _))
                Interlocked.Increment(ref _droppedEvents);
        }
        finally
        {
            if (state is not null)
                await state.Writer.DisposeAsync().ConfigureAwait(false);
        }
    }

    private async Task<WriterState> WriteEventAsync(WriterState? state, DiagnosticEvent item)
    {
        var line = JsonSerializer.Serialize(item);
        var bytes = Encoding.UTF8.GetByteCount(line) + 1;

        if (state is not null && state.Length + bytes > _options.MaxFileBytes)
        {
            await state.Writer.DisposeAsync().ConfigureAwait(false);
            state = null;
            Rotate();
        }

        state ??= OpenWriter();
        await state.Writer.WriteLineAsync(line).ConfigureAwait(false);
        state.Length += bytes;
        return state;
    }

    private WriterState OpenWriter()
    {
        var path = BasePath();

        if (File.Exists(path))
        {
            var length = new FileInfo(path).Length;
            if (length >= _options.MaxFileBytes)
                Rotate();
        }

        var stream = new FileStream(
            path,
            FileMode.Append,
            FileAccess.Write,
            FileShare.Read,
            bufferSize: 4096,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan);

        return new WriterState(
            new StreamWriter(stream, new UTF8Encoding(false), 4096, leaveOpen: false),
            stream.Length);
    }

    private string BasePath() => Path.Combine(_options.DirectoryPath, "sightline.jsonl");

    private void Rotate()
    {
        var basePath = BasePath();

        if (_options.MaxFiles == 1)
        {
            if (File.Exists(basePath))
                File.Delete(basePath);
            return;
        }

        for (var index = _options.MaxFiles - 1; index >= 1; index--)
        {
            var source = index == 1
                ? basePath
                : Path.Combine(_options.DirectoryPath, $"sightline.{index - 1}.jsonl");
            var destination = Path.Combine(_options.DirectoryPath, $"sightline.{index}.jsonl");

            if (File.Exists(destination))
                File.Delete(destination);
            if (File.Exists(source))
                File.Move(source, destination);
        }
    }
}

internal static class DiagnosticStringExtensions
{
    public static string Truncate(this string value, int maxChars) =>
        value.Length <= maxChars ? value : value[..maxChars];
}
