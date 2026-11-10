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
    private readonly IDesktopActionApproval? _approval;

    public FlaUiActionExecutor(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null,
        UiaCircuitBreaker? circuitBreaker = null,
        DiagnosticRecorder? diagnostics = null,
        IDesktopActionApproval? approval = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
        _circuitBreaker = circuitBreaker ?? new UiaCircuitBreaker();
        _diagnostics = diagnostics;
        _approval = approval;
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

        // Never attach to a provider for a known-sensitive control.
        // This also blocks aliases after sensitive observation metadata was redacted.
        if (locator.IsSensitive || SensitiveControlPolicy.IsSensitive(false, locator.Name, locator.AutomationId))
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.PermissionDenied, "Sensitive control actions are not permitted.")));
        }

        // All desktop mutations require a trusted, action-specific host approval.
        // No Windows approval UI has been shipped; default is intentionally DENY.
        // Snapshot/window/element identity must still be revalidated after approval.
        if (_approval?.IsApproved(snapshot, action) != true)
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.ConfirmationRequired, "Explicit trusted Windows action approval is required.")));
        }

        if (!_circuitBreaker.TryEnter(snapshot.ProcessId))
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UiaUnavailable, "UI Automation circuit is temporarily open.")));
        }

        var mutationStarted = false;
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

            // Re-check against the live provider before any side effect.
            // Unknown password metadata is not permission to act.
            var isPassword = Safe(() => element.Properties.IsPassword.Value, true);
            var liveName = SafeText(() => element.Name);
            var liveAutomationId = SafeText(() => element.AutomationId);
            if (SensitiveControlPolicy.IsSensitive(isPassword, liveName, liveAutomationId))
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.PermissionDenied, "Sensitive control actions are not permitted."));

            if (!Safe(() => element.IsEnabled, false))
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.ControlNotActionable, "Target control is disabled."));

            // Once the provider call begins, any exception may mean the mutation
            // succeeded. Never classify that situation as safe-to-retry.
            mutationStarted = true;
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
            if (mutationStarted)
                return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started,
                    Fail(SightlineErrorCode.UnknownEffect, "Action was interrupted after mutation began; reconcile before retry.")));
            RecordCancelled(action, snapshot.ProcessId, started);
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                mutationStarted
                    ? Fail(SightlineErrorCode.UnknownEffect, "UI Automation failed after mutation began; reconcile before retry.")
                    : Fail(SightlineErrorCode.UiaUnavailable, "UI Automation rejected the requested action.")));
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

    private static string? SafeText(Func<string?> read)
    {
        try { return read(); }
        catch { return null; }
    }

    private static ActionReceipt Fail(SightlineErrorCode code, string detail) =>
        new(false, code, false, Detail: detail);

    private static bool Safe(Func<bool> read, bool fallback)
    {
        try { return read(); }
        catch { return fallback; }
    }
}
