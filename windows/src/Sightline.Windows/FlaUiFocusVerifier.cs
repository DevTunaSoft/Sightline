using FlaUI.Core;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiFocusVerifier : IDesktopFocusVerifier
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly FlaUiElementResolver _resolver;
    private readonly UiaRuntimeOptions _runtimeOptions;
    private readonly UiaCircuitBreaker _circuitBreaker;
    private readonly DiagnosticRecorder? _diagnostics;

    public FlaUiFocusVerifier(
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

    public ValueTask<FocusReceipt> FocusAndVerifyAsync(
        SemanticSnapshot snapshot,
        string elementRef,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        cancellationToken.ThrowIfCancellationRequested();
        var started = System.Diagnostics.Stopwatch.GetTimestamp();

        if (!_leases.TryResolve(
                snapshot.SnapshotId,
                snapshot.ProcessId,
                snapshot.WindowHandle,
                elementRef,
                out var locator) ||
            locator is null)
        {
            return ValueTask.FromResult(Recorded(
                elementRef, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.StateChanged, "Element reference is stale.")));
        }

        if (!_circuitBreaker.TryEnter(snapshot.ProcessId))
        {
            return ValueTask.FromResult(Recorded(
                elementRef, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UiaUnavailable, "UI Automation circuit is temporarily open.")));
        }

        try
        {
            using var application = Application.Attach(snapshot.ProcessId);
            using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
            var window = application.GetMainWindow(automation);
            if (window is null)
                return ValueTask.FromResult(HealthyFailure(elementRef, snapshot.ProcessId, started,
                    SightlineErrorCode.WindowNotFound, "Target window is unavailable."));

            if (window.Properties.NativeWindowHandle.ValueOrDefault != snapshot.WindowHandle)
                return ValueTask.FromResult(HealthyFailure(elementRef, snapshot.ProcessId, started,
                    SightlineErrorCode.StateChanged, "Target window identity changed."));

            var element = _resolver.ResolveUnique(window, automation, locator, cancellationToken);
            if (element is null)
                return ValueTask.FromResult(HealthyFailure(elementRef, snapshot.ProcessId, started,
                    SightlineErrorCode.StateChanged, "Target element changed or is ambiguous."));

            if (!element.Properties.IsKeyboardFocusable.ValueOrDefault)
                return ValueTask.FromResult(HealthyFailure(elementRef, snapshot.ProcessId, started,
                    SightlineErrorCode.ControlNotActionable, "Target cannot accept keyboard focus."));

            element.Focus();
            var verified = element.Properties.HasKeyboardFocus.ValueOrDefault;
            var receipt = verified
                ? new FocusReceipt(true, null, "Target reported keyboard focus.")
                : Fail(SightlineErrorCode.VerificationFailed, "Target did not report keyboard focus after focus request.");

            _circuitBreaker.RecordSuccess(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(elementRef, snapshot.ProcessId, started, receipt));
        }
        catch (OperationCanceledException)
        {
            _circuitBreaker.RecordNeutral(snapshot.ProcessId);
            _diagnostics?.Record(new DiagnosticEvent(
                DateTimeOffset.UtcNow,
                "INFO",
                "uia.focus",
                Capability: "Windows.UIAutomation",
                Operation: "Focus",
                TargetRef: elementRef,
                DurationMs: (long)System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                Result: "CANCELLED",
                ErrorCode: SightlineErrorCode.UserInterrupted.ToString(),
                Detail: $"process={snapshot.ProcessId}"));
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(
                elementRef, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UiaUnavailable, "UI Automation could not verify keyboard focus.")));
        }
    }

    private FocusReceipt HealthyFailure(
        string elementRef,
        int processId,
        long started,
        SightlineErrorCode code,
        string detail)
    {
        _circuitBreaker.RecordSuccess(processId);
        return Recorded(elementRef, processId, started, Fail(code, detail));
    }

    private FocusReceipt Recorded(
        string elementRef,
        int processId,
        long started,
        FocusReceipt receipt)
    {
        _diagnostics?.Record(new DiagnosticEvent(
            DateTimeOffset.UtcNow,
            receipt.Ok ? "INFO" : "WARN",
            "uia.focus",
            Capability: "Windows.UIAutomation",
            Operation: "Focus",
            TargetRef: elementRef,
            DurationMs: (long)System.Diagnostics.Stopwatch.GetElapsedTime(started).TotalMilliseconds,
            Result: receipt.Ok ? "VERIFIED" : "FAIL",
            ErrorCode: receipt.ErrorCode?.ToString(),
            Detail: $"process={processId}"));
        return receipt;
    }

    private static FocusReceipt Fail(SightlineErrorCode code, string detail) =>
        new(false, code, detail);
}
