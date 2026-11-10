namespace Sightline.Windows;

public sealed record UiaCircuitBreakerOptions(
    int MaxProcesses = 32,
    int FailureThreshold = 3,
    TimeSpan? Cooldown = null)
{
    public TimeSpan EffectiveCooldown => Cooldown ?? TimeSpan.FromSeconds(5);

    public void Validate()
    {
        if (MaxProcesses is < 1 or > 256)
            throw new ArgumentOutOfRangeException(nameof(MaxProcesses));
        if (FailureThreshold is < 1 or > 20)
            throw new ArgumentOutOfRangeException(nameof(FailureThreshold));
        if (EffectiveCooldown < TimeSpan.FromMilliseconds(250) ||
            EffectiveCooldown > TimeSpan.FromMinutes(5))
            throw new ArgumentOutOfRangeException(nameof(Cooldown));
    }
}

public sealed class UiaCircuitBreaker
{
    private sealed class Entry
    {
        public int Failures;
        public DateTimeOffset? OpenUntil;
        public bool ProbeInFlight;
        public long Touch;
    }

    private readonly UiaCircuitBreakerOptions _options;
    private readonly Func<DateTimeOffset> _clock;
    private readonly Dictionary<int, Entry> _entries = new();
    private readonly object _gate = new();
    private long _touch;

    public UiaCircuitBreaker(
        UiaCircuitBreakerOptions? options = null,
        Func<DateTimeOffset>? clock = null)
    {
        _options = options ?? new UiaCircuitBreakerOptions();
        _options.Validate();
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    public int TrackedProcessCount
    {
        get { lock (_gate) return _entries.Count; }
    }

    public bool TryEnter(int processId)
    {
        if (processId <= 0)
            return false;

        lock (_gate)
        {
            if (!_entries.TryGetValue(processId, out var entry))
                return true;

            entry.Touch = ++_touch;
            if (entry.OpenUntil is null)
                return true;

            if (_clock() < entry.OpenUntil.Value)
                return false;

            if (entry.ProbeInFlight)
                return false;

            entry.ProbeInFlight = true;
            return true;
        }
    }

    public void RecordSuccess(int processId)
    {
        if (processId <= 0)
            return;

        lock (_gate)
            _entries.Remove(processId);
    }

    public void RecordFailure(int processId)
    {
        if (processId <= 0)
            return;

        lock (_gate)
        {
            if (!_entries.TryGetValue(processId, out var entry))
            {
                EnsureCapacityForNewEntry();
                entry = new Entry();
                _entries.Add(processId, entry);
            }

            entry.Touch = ++_touch;
            var wasProbe = entry.ProbeInFlight;
            entry.ProbeInFlight = false;

            if (wasProbe)
            {
                entry.Failures = _options.FailureThreshold;
                entry.OpenUntil = _clock() + _options.EffectiveCooldown;
                return;
            }

            entry.Failures++;
            if (entry.Failures >= _options.FailureThreshold)
                entry.OpenUntil = _clock() + _options.EffectiveCooldown;
        }
    }

    private void EnsureCapacityForNewEntry()
    {
        if (_entries.Count < _options.MaxProcesses)
            return;

        var oldest = _entries.Aggregate((left, right) =>
            left.Value.Touch <= right.Value.Touch ? left : right).Key;
        _entries.Remove(oldest);
    }
}
