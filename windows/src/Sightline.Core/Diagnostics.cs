namespace Sightline.Core;

public sealed record DiagnosticEvent(
    DateTimeOffset Timestamp,
    string Level,
    string EventName,
    string? TaskId = null,
    string? Step = null,
    string? Capability = null,
    string? Operation = null,
    string? TargetRef = null,
    long? DurationMs = null,
    string? Result = null,
    string? ErrorCode = null,
    string? Detail = null);

public sealed class BoundedDiagnosticLedger
{
    private DiagnosticEvent?[]? _buffer;
    private readonly int _capacity;
    private readonly object _gate = new();
    private int _next;
    private int _count;

    public BoundedDiagnosticLedger(int capacity = 512)
    {
        if (capacity is < 16 or > 8192)
            throw new ArgumentOutOfRangeException(nameof(capacity));
        _capacity = capacity;
    }

    public int Capacity => _capacity;

    public void Add(DiagnosticEvent item)
    {
        ArgumentNullException.ThrowIfNull(item);
        lock (_gate)
        {
            _buffer ??= new DiagnosticEvent[_capacity];
            _buffer[_next] = item;
            _next = (_next + 1) % _capacity;
            if (_count < _capacity) _count++;
        }
    }

    public IReadOnlyList<DiagnosticEvent> Snapshot()
    {
        lock (_gate)
        {
            if (_count == 0)
                return Array.Empty<DiagnosticEvent>();

            var buffer = _buffer!;
            var result = new DiagnosticEvent[_count];
            var start = (_next - _count + _capacity) % _capacity;
            for (var i = 0; i < _count; i++)
                result[i] = buffer[(start + i) % _capacity]!;
            return result;
        }
    }
}

public sealed class DiagnosticRecorder : IAsyncDisposable
{
    private readonly BoundedDiagnosticLedger _ledger;
    private readonly BoundedDiagnosticFileSink? _fileSink;
    private readonly int _maxDetailChars;

    public DiagnosticRecorder(
        int ledgerCapacity = 256,
        DiagnosticFileOptions? fileOptions = null)
    {
        _ledger = new BoundedDiagnosticLedger(ledgerCapacity);
        _maxDetailChars = fileOptions?.MaxDetailChars ?? 1000;

        if (fileOptions is not null)
        {
            fileOptions.Validate();
            _fileSink = new BoundedDiagnosticFileSink(fileOptions);
        }
    }

    public int LedgerCapacity => _ledger.Capacity;
    public long DroppedFileEvents => _fileSink?.DroppedEvents ?? 0;
    public string? FileFailure => _fileSink?.LastFailure;

    public void Record(DiagnosticEvent item)
    {
        var sanitized = DiagnosticSanitizer.Sanitize(item, _maxDetailChars);
        _ledger.Add(sanitized);
        _fileSink?.TryWriteSanitized(sanitized);
    }

    public IReadOnlyList<DiagnosticEvent> Snapshot() => _ledger.Snapshot();

    public async ValueTask DisposeAsync()
    {
        if (_fileSink is not null)
            await _fileSink.DisposeAsync().ConfigureAwait(false);
    }
}
