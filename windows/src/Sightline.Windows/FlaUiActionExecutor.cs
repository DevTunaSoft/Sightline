using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiActionExecutor : IDesktopActionExecutor
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly FlaUiElementResolver _resolver;
    private readonly UiaRuntimeOptions _runtimeOptions;

    public FlaUiActionExecutor(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
    }

    public ValueTask<ActionReceipt> ExecuteAsync(
        SemanticSnapshot snapshot,
        SemanticAction action,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(action);
        cancellationToken.ThrowIfCancellationRequested();

        if (!_leases.TryResolve(
                snapshot.SnapshotId,
                snapshot.ProcessId,
                snapshot.WindowHandle,
                action.Ref,
                out var locator) ||
            locator is null)
        {
            return ValueTask.FromResult(Fail(SightlineErrorCode.StateChanged, "Element reference is stale."));
        }

        using var application = Application.Attach(snapshot.ProcessId);
        using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
        var window = application.GetMainWindow(automation);
        if (window is null)
            return ValueTask.FromResult(Fail(SightlineErrorCode.WindowNotFound, "Target window is unavailable."));

        if (window.Properties.NativeWindowHandle.ValueOrDefault != snapshot.WindowHandle)
            return ValueTask.FromResult(Fail(SightlineErrorCode.StateChanged, "Target window identity changed."));

        var element = _resolver.ResolveUnique(window, automation, locator, cancellationToken);
        if (element is null)
            return ValueTask.FromResult(Fail(SightlineErrorCode.StateChanged, "Target element changed or is ambiguous."));
        if (!Safe(() => element.IsEnabled, false))
            return ValueTask.FromResult(Fail(SightlineErrorCode.ControlNotActionable, "Target control is disabled."));

        try
        {
            return action.Kind switch
            {
                SemanticActionKind.Invoke => ValueTask.FromResult(Invoke(element)),
                SemanticActionKind.SetValue => ValueTask.FromResult(SetValue(element, action.Value)),
                _ => ValueTask.FromResult(Fail(SightlineErrorCode.ControlNotActionable, "Unsupported semantic action."))
            };
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch
        {
            return ValueTask.FromResult(Fail(SightlineErrorCode.UiaUnavailable, "UI Automation rejected the requested action."));
        }
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
