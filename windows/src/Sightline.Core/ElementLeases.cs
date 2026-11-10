using System.Threading;

namespace Sightline.Core;

public sealed class ElementLeaseRegistry<TLocator> where TLocator : class
{
    private readonly int _capacity;
    private Dictionary<string, TLocator>? _current;
    private readonly object _gate = new();
    private long _nextRef;
    private long _generation;
    private string? _snapshotId;
    private int _processId;
    private long _windowHandle;

    public ElementLeaseRegistry(int capacity = 1024)
    {
        if (capacity is < 16 or > 10_000)
            throw new ArgumentOutOfRangeException(nameof(capacity));

        _capacity = capacity;
    }

    public int Capacity => _capacity;
    public int Count { get { lock (_gate) return _current?.Count ?? 0; } }
    public long Generation { get { lock (_gate) return _generation; } }

    public void BeginSnapshot(string snapshotId, int processId, long windowHandle)
    {
        if (string.IsNullOrWhiteSpace(snapshotId))
            throw new ArgumentException("Snapshot id is required.", nameof(snapshotId));
        if (processId <= 0)
            throw new ArgumentOutOfRangeException(nameof(processId));

        lock (_gate)
        {
            _current?.Clear();
            _snapshotId = snapshotId;
            _processId = processId;
            _windowHandle = windowHandle;
            _generation++;
        }
    }

    public string Register(TLocator locator)
    {
        ArgumentNullException.ThrowIfNull(locator);
        lock (_gate)
        {
            if (_snapshotId is null)
                throw new InvalidOperationException("BeginSnapshot must be called before registering elements.");
            _current ??= new Dictionary<string, TLocator>(StringComparer.Ordinal);
            if (_current.Count >= _capacity)
                throw new InvalidOperationException(SightlineErrorCode.ResourceLimitExceeded.ToString());

            var sequence = Interlocked.Increment(ref _nextRef);
            var elementRef = $"w:{_processId}:g{_generation}:e{sequence}";
            _current.Add(elementRef, locator);
            return elementRef;
        }
    }

    public bool TryResolve(
        string snapshotId,
        int processId,
        long windowHandle,
        string elementRef,
        out TLocator? locator)
    {
        lock (_gate)
        {
            locator = null;
            if (_snapshotId is null ||
                !string.Equals(_snapshotId, snapshotId, StringComparison.Ordinal) ||
                processId != _processId ||
                windowHandle != _windowHandle ||
                string.IsNullOrWhiteSpace(elementRef))
            {
                return false;
            }

            return _current is not null && _current.TryGetValue(elementRef, out locator);
        }
    }
}
