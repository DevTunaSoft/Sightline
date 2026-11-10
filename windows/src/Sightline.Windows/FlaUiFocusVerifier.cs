using FlaUI.Core;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiFocusVerifier : IDesktopFocusVerifier
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly FlaUiElementResolver _resolver;
    private readonly UiaRuntimeOptions _runtimeOptions;

    public FlaUiFocusVerifier(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
    }

    public ValueTask<FocusReceipt> FocusAndVerifyAsync(
        SemanticSnapshot snapshot,
        string elementRef,
        CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        cancellationToken.ThrowIfCancellationRequested();

        if (!_leases.TryResolve(
                snapshot.SnapshotId,
                snapshot.ProcessId,
                snapshot.WindowHandle,
                elementRef,
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

        try
        {
            if (!element.Properties.IsKeyboardFocusable.ValueOrDefault)
                return ValueTask.FromResult(Fail(SightlineErrorCode.ControlNotActionable, "Target cannot accept keyboard focus."));

            element.Focus();
            var verified = element.Properties.HasKeyboardFocus.ValueOrDefault;
            return ValueTask.FromResult(verified
                ? new FocusReceipt(true, null, "Target reported keyboard focus.")
                : Fail(SightlineErrorCode.VerificationFailed, "Target did not report keyboard focus after focus request."));
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch
        {
            return ValueTask.FromResult(Fail(SightlineErrorCode.UiaUnavailable, "UI Automation could not verify keyboard focus."));
        }
    }

    private static FocusReceipt Fail(SightlineErrorCode code, string detail) =>
        new(false, code, detail);
}
