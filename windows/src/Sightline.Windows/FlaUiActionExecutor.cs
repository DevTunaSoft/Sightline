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
    private readonly IDesktopMutationJournal? _journal;

    public FlaUiActionExecutor(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null,
        UiaCircuitBreaker? circuitBreaker = null,
        DiagnosticRecorder? diagnostics = null,
        IDesktopActionApproval? approval = null,
        IDesktopMutationJournal? journal = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
        _circuitBreaker = circuitBreaker ?? new UiaCircuitBreaker();
        _diagnostics = diagnostics;
        _approval = approval;
        _journal = journal;
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

        if (!DesktopActionValidation.IsValid(action))
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.ControlNotActionable, "Malformed or oversized desktop action.")));
        }

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

        // Sensitive observation intentionally erases identifying metadata. Check
        // the leased sensitivity flag BEFORE rejecting an unnamed locator, so
        // credential controls cannot be misreported as ordinary stale targets.
        if (locator.IsSensitive || SensitiveControlPolicy.IsSensitive(false, locator.Name, locator.AutomationId))
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.PermissionDenied, "Sensitive control actions are not permitted.")));
        }

        if (!locator.IsIdentifiable)
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.StateChanged, "Control lacks reliable identifying metadata.")));

        // All desktop mutations require a trusted, action-specific host approval.
        // No Windows approval UI has been shipped; default is intentionally DENY.
        // Snapshot/window/element identity must still be revalidated after approval.
        bool approved;
        try { approved = _approval?.IsApproved(snapshot, action) == true; }
        catch { approved = false; }
        if (!approved)
        {
            return ValueTask.FromResult(Recorded(
                action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.ConfirmationRequired, "Explicit trusted Windows action approval is required.")));
        }

        if (_journal is null)
            return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.PermissionDenied, "Durable Windows mutation journal is required.")));

        // Avoid allocating a FlaUI automation session when a prior, unresolved
        // action already blocks mutation. Inaccessible journal state fails closed.
        bool pending;
        try { pending = _journal.HasPending; }
        catch { pending = true; }
        if (pending)
            return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started,
                Fail(SightlineErrorCode.UnknownEffect, "Previous desktop action requires reconciliation.")));

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

            // Persist a single bounded record *before* touching the provider.
            // Missing storage and unresolved actions both fail closed.
            cancellationToken.ThrowIfCancellationRequested();
            bool durable;
            try { durable = _journal.TryBegin(snapshot, action); }
            catch { durable = false; }
            if (!durable)
                return ValueTask.FromResult(HealthyFailure(action, snapshot.ProcessId, started,
                    SightlineErrorCode.UnknownEffect, "Unresolved or unavailable action journal; reconcile before retry."));

            // An exception after this boundary may mean the action was applied.
            mutationStarted = true;
            cancellationToken.ThrowIfCancellationRequested();
            var receipt = action.Kind switch
            {
                SemanticActionKind.Invoke => Invoke(element),
                SemanticActionKind.SetValue => SetValue(element, action.Value),
                _ => Fail(SightlineErrorCode.ControlNotActionable, "Unsupported semantic action.")
            };

            if (receipt.Ok && receipt.Verified)
            {
                bool cleared;
                try { cleared = _journal.TryCompleteVerified(); }
                catch { cleared = false; }
                if (!cleared)
                    receipt = Fail(SightlineErrorCode.UnknownEffect,
                        "Verified action could not clear its durable record; reconcile before retry.");
            }
            else
            {
                // Invoke has no generic effect oracle. Even if UIA accepted it,
                // never silently allow a second mutation until external review.
                try { _journal.PreserveUnknown(); } catch { }
                if (!receipt.Ok)
                    receipt = Fail(SightlineErrorCode.UnknownEffect,
                        "Action outcome is uncertain; reconcile before retry.");
            }
            _circuitBreaker.RecordSuccess(snapshot.ProcessId);
            return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started, receipt));
        }
        catch (OperationCanceledException)
        {
            _circuitBreaker.RecordNeutral(snapshot.ProcessId);
            if (mutationStarted)
            {
                try { _journal?.PreserveUnknown(); } catch { }
                return ValueTask.FromResult(Recorded(action, snapshot.ProcessId, started,
                    Fail(SightlineErrorCode.UnknownEffect, "Action was interrupted after mutation began; reconcile before retry.")));
            }
            RecordCancelled(action, snapshot.ProcessId, started);
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(snapshot.ProcessId);
            if (mutationStarted)
            {
                try { _journal?.PreserveUnknown(); } catch { }
            }
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
        // Readback is compared in-process and immediately discarded. Never
        // return a field's text (which could have become sensitive) in a receipt.
        return DesktopValueVerification.FromReadback(requestedValue, pattern.Value.Value);
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
