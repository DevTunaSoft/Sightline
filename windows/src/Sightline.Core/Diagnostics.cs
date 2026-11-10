namespace Sightline.Core;

public sealed record DiagnosticEvent(
    DateTimeOffset Timestamp,
    string Level,
    string EventName,
    string? TaskId = null,
    string? Detail = null);

public sealed class BoundedDiagnosticLedger
{
    private readonly DiagnosticEvent?[] _buffer;
    private readonly object _gate = new();
    private int _next;
    private int _count;

    public BoundedDiagnosticLedger(int capacity = 512)
    {
        if (capacity is < 16 or > 8192)
            throw new ArgumentOutOfRangeException(nameof(capacity));
        _buffer = new DiagnosticEvent[capacity];
    }

    public int Capacity => _buffer.Length;

    public void Add(DiagnosticEvent item)
    {
        ArgumentNullException.ThrowIfNull(item);
        lock (_gate)
        {
            _buffer[_next] = item;
            _next = (_next + 1) % _buffer.Length;
            if (_count < _buffer.Length) _count++;
        }
    }

    public IReadOnlyList<DiagnosticEvent> Snapshot()
    {
        lock (_gate)
        {
            var result = new DiagnosticEvent[_count];
            var start = (_next - _count + _buffer.Length) % _buffer.Length;
            for (var i = 0; i < _count; i++)
                result[i] = _buffer[(start + i) % _buffer.Length]!;
            return result;
        }
    }
}
