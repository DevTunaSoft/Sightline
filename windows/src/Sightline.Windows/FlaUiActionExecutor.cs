using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiActionExecutor : IDesktopActionExecutor
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly FlaUiElementResolver _resolver;
    private readonly UiaRuntimeOptions _runtimeOptions;
    private readonly UiaCircuitBreaker _circuitBreaker;
    private readonly DiagnosticRecorder? _diagnostics;

    public FlaUiActionExecutor(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null,
        UiaCircuitBreaker? circuitBreaker = null,
        DiagnosticRecorder? diagnostics = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
        _circuitBreaker = circuitBreaker ?? new UiaCircuitBreaker();
        _diagnostics = diagnostics;
    }

    public ValueTask<ActionReceipt> ExecuteAsync(
        SemanticSnapshot snapshot,
        SemanticAction action,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(action);
        cancellationToken.ThrowIfCancellationRequested();
        var started = System.Diagnostics.Stopwatch.GetTimestamp();

        if (!_leases.TryResolve(
                snapshot.SnapshotId,
                snapshot.ProcessId,
                snapshot.WindowHandle,
                action.Ref,
                out var locator) ||
            locator is null)
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.StateChanged, "Element reference is stale.")));
        }

        if (!_circuitBreaker.TryEnter(snapshot.ProcessId))
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UiaUnavailable, "UI Automation circuit is temporarily open.")));
        }

        try
        {
            using var application = Application.Attach(snapshot.ProcessId);
            using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
            var window = application.GetMainWindow(automation);
            if (window is null)
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.WindowNotFound, "Target window is unavailable."));

            if (window.Properties.NativeWindowHandle.ValueOrDefault != snapshot.WindowHandle)
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.StateChanged, "Target window identity changed."));

            var element = _resolver.ResolveUnique(window, automation, locator, cancellationToken);
            if (element is null)
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.StateChanged, "Target element changed or is ambiguous."));

            if (!Safe(() => element.IsEnabled, false))
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.ControlNotActionable, "Target control is disabled."));

            var receipt = action.Kind switch
            {
                SemanticActionKind.Invoke => Invoke(element),
                SemanticActionKind.SetValue => SetValue(element, action.Value),
                _ => Fail(SightlineErrorCode.ControlNotActionable, "Unsupported semantic action.")
            };

            _circuitBreaker.RecordSuccess(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started, receipt));
        }
        catch (OperationCanceledException)
        {
            _circuitBreaker.RecordNeutral(snapshot.ProcessId);
            RecordCancelled(action, snapshot.ProcessId, started);
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UiaUnavailable, "UI Automation rejected the requested action.")));
        }
    }

    private ActionReceipt HealthyFailure(
        SemanticAction action,
        int processId,
        long started,
        SightlineErrorCode code,
        string detail)
    {
        _circuitBreaker.RecordSuccess(processId);
        return Recorded(action, processId, started, Fail(code, detail));
    }

    private ActionReceipt Recorded(
        SemanticAction action,
        int processId,
        long started,
        ActionReceipt receipt)
    {
        _diagnostics?.Record(new DiagnosticEvent(
            DateTimeOffset.UtcNow,
            receipt.Ok ? "INFO" : "WARN",
            "uia.action",
            Capability: "Windows.UIAutomation",
            Operation: action.Kind.ToString(),
            TargetRef: action.Ref,
            DurationMs: (long)System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            Result: receipt.Ok ? (receipt.Verified ? "VERIFIED" : "ACCEPTED") : "FAIL",
            ErrorCode: receipt.ErrorCode?.ToString(),
            Detail: $"process={processId};verified={receipt.Verified}"));
        return receipt;
    }

    private void RecordCancelled(SemanticAction action, int processId, long started)
    {
        _diagnostics?.Record(new DiagnosticEvent(
            DateTimeOffset.UtcNow,
            "INFO",
            "uia.action",
            Capability: "Windows.UIAutomation",
            Operation: action.Kind.ToString(),
            TargetRef: action.Ref,
            DurationMs: (long)System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            Result: "CANCELLED",
            ErrorCode: SightlineErrorCode.UserInterrupted.ToString(),
            Detail: $"process={processId}"));
    }

    private static ActionReceipt Invoke(AutomationElement element)
    {
        var pattern = element.Patterns.Invoke.PatternOrDefault;
        if (pattern is null)
            return Fail(SightlineErrorCode.ControlNotActionable, "Invoke pattern is unavailable.");

        pattern.Invoke();
        return new ActionReceipt(
            Ok: true,
            ErrorCode: null,
            Verified: false,
            Detail: "Invoke was accepted by UI Automation; application-specific effect verification is still required.");
    }

    private static ActionReceipt SetValue(AutomationElement element, string? requestedValue)
    {
        if (requestedValue is null)
            return Fail(SightlineErrorCode.ControlNotActionable, "SetValue requires a value.");

        var pattern = element.Patterns.Value.PatternOrDefault;
        if (pattern is null)
            return Fail(SightlineErrorCode.ControlNotActionable, "Value pattern is unavailable.");
        if (pattern.IsReadOnly.ValueOrDefault)
            return Fail(SightlineErrorCode.ControlNotActionable, "Target value is read-only.");

        pattern.SetValue(requestedValue);
        var readback = pattern.Value.Value;
        var verified = string.Equals(readback, requestedValue, StringComparison.Ordinal);

        return new ActionReceipt(
            Ok: verified,
            ErrorCode: verified ? null : SightlineErrorCode.VerificationFailed,
            Verified: verified,
            Readback: readback,
            Detail: verified ? "Value readback matched." : "Value readback did not match.");
    }

    private static ActionReceipt Fail(SightlineErrorCode code, string detail) =>
        new(false, code, false, Detail: detail);

    private static bool Safe(Func<bool> read, bool fallback)
    {
        try { return read(); }
        catch { return fallback; }
    }
}
