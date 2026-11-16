using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiDesktopObserver : IDesktopObserver
{
    private static long _snapshotSequence;
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly UiaRuntimeOptions _runtimeOptions;
    private readonly UiaCircuitBreaker _circuitBreaker;
    private readonly DiagnosticRecorder? _diagnostics;

    public FlaUiDesktopObserver(
        ElementLeaseRegistry<WindowsElementLocator>? leases = null,
        UiaRuntimeOptions? runtimeOptions = null,
        UiaCircuitBreaker? circuitBreaker = null,
        DiagnosticRecorder? diagnostics = null)
    {
        _leases = leases ?? new ElementLeaseRegistry<WindowsElementLocator>();
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
        _circuitBreaker = circuitBreaker ?? new UiaCircuitBreaker();
        _diagnostics = diagnostics;
    }

    public ElementLeaseRegistry<WindowsElementLocator> Leases => _leases;

    public ValueTask<SemanticSnapshot> ObserveAsync(
        int processId,
        ObservationBudget budget,
        CancellationToken cancellationToken = default)
    {
        budget.Validate();
        cancellationToken.ThrowIfCancellationRequested();
        var started = System.Diagnostics.Stopwatch.GetTimestamp();
        var effectiveBudget = budget.MaxNodes <= _leases.Capacity
            ? budget
            : budget with { MaxNodes = _leases.Capacity };

        if (!_circuitBreaker.TryEnter(processId))
        {
            Record(processId, started, "BLOCKED", SightlineErrorCode.UiaUnavailable, "circuit-open");
            throw new InvalidOperationException($"{SightlineErrorCode.UiaUnavailable}: circuit open.");
        }

        try
        {
            using var application = Application.Attach(processId);
            using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
            var window = application.GetMainWindow(automation);
            if (window is null)
            {
                _circuitBreaker.RecordSuccess(processId);
                Record(processId, started, "FAIL", SightlineErrorCode.WindowNotFound, null);
                throw new InvalidOperationException(SightlineErrorCode.WindowNotFound.ToString());
            }

            var walker = automation.TreeWalkerFactory.GetControlViewWalker();
            IEnumerable<AutomationElement> Children(AutomationElement parent)
            {
                var child = walker.GetFirstChild(parent);
                while (child is not null)
                {
                    yield return child;
                    child = walker.GetNextSibling(child);
                }
            }

            var nodes = new BoundedTraversal<AutomationElement>().Walk(
                window,
                Children,
                effectiveBudget,
                cancellationToken,
                out var truncated,
                out var reason);

            var handle = window.Properties.NativeWindowHandle.ValueOrDefault;
            var snapshotId = $"ws:{processId}:{Interlocked.Increment(ref _snapshotSequence)}";
            _leases.BeginSnapshot(snapshotId, processId, handle);

            var elements = new List<SemanticElement>(nodes.Count);
            foreach (var (node, depth) in nodes)
            {
                cancellationToken.ThrowIfCancellationRequested();
                var name = Safe(() => node.Name);
                var automationId = Safe(() => node.AutomationId);
                var controlType = Safe(() => node.ControlType.ToString()) ?? "Unknown";
                // A provider refusing IsPassword metadata is treated as sensitive.
                var isPassword = Safe(() => node.Properties.IsPassword.Value, true);
                var sensitive = SensitiveControlPolicy.IsSensitive(isPassword, name, automationId);
                if (sensitive)
                {
                    name = null;
                    automationId = null;
                }
                var elementRef = _leases.Register(new WindowsElementLocator(automationId, name, controlType, sensitive));

                elements.Add(new SemanticElement(
                    Ref: elementRef,
                    Name: name,
                    AutomationId: automationId,
                    ControlType: controlType,
                    IsEnabled: Safe(() => node.IsEnabled, false),
                    Depth: depth));
            }

            var snapshot = new SemanticSnapshot(
                SnapshotId: snapshotId,
                ProcessId: processId,
                WindowHandle: handle,
                CapturedAt: DateTimeOffset.UtcNow,
                Elements: elements,
                Truncated: truncated,
                TruncationReason: reason);

            _circuitBreaker.RecordSuccess(processId);
            Record(processId, started, "PASS", null, $"elements={elements.Count};truncated={truncated}");
            return ValueTask.FromResult(snapshot);
        }
        catch (OperationCanceledException)
        {
            _circuitBreaker.RecordNeutral(processId);
            Record(processId, started, "CANCELLED", SightlineErrorCode.UserInterrupted, null);
            throw;
        }
        catch (InvalidOperationException ex) when (
            string.Equals(ex.Message, SightlineErrorCode.WindowNotFound.ToString(), StringComparison.Ordinal))
        {
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(processId);
            Record(processId, started, "FAIL", SightlineErrorCode.UiaUnavailable, null);
            throw;
        }
    }

    private void Record(
        int processId,
        long started,
        string result,
        SightlineErrorCode? errorCode,
        string? detail)
    {
        _diagnostics?.Record(new DiagnosticEvent(
            DateTimeOffset.UtcNow,
            result == "FAIL" ? "ERROR" : result == "BLOCKED" ? "WARN" : "INFO",
            "uia.observe",
            Capability: "Windows.UIAutomation",
            Operation: "Observe",
            DurationMs: (long)System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            Result: result,
            ErrorCode: errorCode?.ToString(),
            Detail: detail is null ? $"process={processId}" : $"process={processId};{detail}"));
    }

    private static string? Safe(Func<string?> read)
    {
        try { return read(); }
        catch { return null; }
    }

    private static bool Safe(Func<bool> read, bool fallback)
    {
        try { return read(); }
        catch { return fallback; }
    }
}
