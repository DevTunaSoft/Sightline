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
    }
}

public sealed class BoundedDiagnosticFileSink : IAsyncDisposable
{
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

        DiagnosticEvent sanitized;
        try
        {
            sanitized = DiagnosticSanitizer.Sanitize(item, _options.MaxDetailChars);
        }
        catch
        {
            Interlocked.Increment(ref _droppedEvents);
            return false;
        }

        if (_channel.Writer.TryWrite(sanitized))
            return true;

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
        StreamWriter? writer = null;
        try
        {
            Directory.CreateDirectory(_options.DirectoryPath);
            await foreach (var first in _channel.Reader.ReadAllAsync().ConfigureAwait(false))
            {
                writer = await EnsureWriterAsync(writer, first).ConfigureAwait(false);
                await WriteAsync(writer, first).ConfigureAwait(false);

                var batchCount = 1;
                while (batchCount < 32 && _channel.Reader.TryRead(out var next))
                {
                    writer = await EnsureWriterAsync(writer, next).ConfigureAwait(false);
                    await WriteAsync(writer, next).ConfigureAwait(false);
                    batchCount++;
                }

                await writer.FlushAsync().ConfigureAwait(false);
            }
        }
        catch (Exception ex)
        {
            lock (_statusGate)
                _lastFailure = $"{ex.GetType().Name}: {ex.Message}".Trim();

            _channel.Writer.TryComplete();
            while (_channel.Reader.TryRead(out _))
                Interlocked.Increment(ref _droppedEvents);
        }
        finally
        {
            if (writer is not null)
                await writer.DisposeAsync().ConfigureAwait(false);
        }
    }

    private async Task<StreamWriter> EnsureWriterAsync(StreamWriter? writer, DiagnosticEvent item)
    {
        var line = Serialize(item);
        var bytes = Encoding.UTF8.GetByteCount(line) + 1;

        if (writer is not null)
        {
            await writer.FlushAsync().ConfigureAwait(false);
            if (writer.BaseStream.Length + bytes <= _options.MaxFileBytes)
                return writer;

            await writer.DisposeAsync().ConfigureAwait(false);
            writer = null;
            Rotate();
        }

        var path = BasePath();
        var stream = new FileStream(
            path,
            FileMode.Append,
            FileAccess.Write,
            FileShare.Read,
            bufferSize: 4096,
            options: FileOptions.Asynchronous | FileOptions.SequentialScan);

        if (stream.Length + bytes > _options.MaxFileBytes && stream.Length > 0)
        {
            await stream.DisposeAsync().ConfigureAwait(false);
            Rotate();
            stream = new FileStream(
                path,
                FileMode.Create,
                FileAccess.Write,
                FileShare.Read,
                bufferSize: 4096,
                options: FileOptions.Asynchronous | FileOptions.SequentialScan);
        }

        return new StreamWriter(stream, new UTF8Encoding(false), 4096, leaveOpen: false);
    }

    private static Task WriteAsync(StreamWriter writer, DiagnosticEvent item) =>
        writer.WriteLineAsync(Serialize(item));

    private static string Serialize(DiagnosticEvent item) =>
        JsonSerializer.Serialize(item);

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
