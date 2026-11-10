using FlaUI.Core;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiFocusVerifier : IDesktopFocusVerifier
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly FlaUiElementResolver _resolver;
    private readonly UiaRuntimeOptions _runtimeOptions;
    private readonly UiaCircuitBreaker _circuitBreaker;

    public FlaUiFocusVerifier(
        ElementLeaseRegistry<WindowsElementLocator> leases,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null,
        UiaCircuitBreaker? circuitBreaker = null)
    {
        _leases = leases ?? throw new ArgumentNullException(nameof(leases));
        _resolver = new FlaUiElementResolver(resolutionBudget);
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
        _circuitBreaker = circuitBreaker ?? new UiaCircuitBreaker();
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

        if (!_circuitBreaker.TryEnter(snapshot.ProcessId))
            return ValueTask.FromResult(Fail(SightlineErrorCode.UiaUnavailable, "UI Automation circuit is temporarily open."));

        try
        {
            using var application = Application.Attach(snapshot.ProcessId);
            using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
            var window = application.GetMainWindow(automation);
            if (window is null)
            {
                _circuitBreaker.RecordSuccess(snapshot.ProcessId);
                return ValueTask.FromResult(Fail(SightlineErrorCode.WindowNotFound, "Target window is unavailable."));
            }

            if (window.Properties.NativeWindowHandle.ValueOrDefault != snapshot.WindowHandle)
            {
                _circuitBreaker.RecordSuccess(snapshot.ProcessId);
                return ValueTask.FromResult(Fail(SightlineErrorCode.StateChanged, "Target window identity changed."));
            }

            var element = _resolver.ResolveUnique(window, automation, locator, cancellationToken);
            if (element is null)
            {
                _circuitBreaker.RecordSuccess(snapshot.ProcessId);
                return ValueTask.FromResult(Fail(SightlineErrorCode.StateChanged, "Target element changed or is ambiguous."));
            }

            if (!element.Properties.IsKeyboardFocusable.ValueOrDefault)
            {
                _circuitBreaker.RecordSuccess(snapshot.ProcessId);
                return ValueTask.FromResult(Fail(SightlineErrorCode.ControlNotActionable, "Target cannot accept keyboard focus."));
            }

            element.Focus();
            var verified = element.Properties.HasKeyboardFocus.ValueOrDefault;
            var receipt = verified
                ? new FocusReceipt(true, null, "Target reported keyboard focus.")
                : Fail(SightlineErrorCode.VerificationFailed, "Target did not report keyboard focus after focus request.");
            _circuitBreaker.RecordSuccess(snapshot.ProcessId);
            return ValueTask.FromResult(receipt);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch
        {
            _circuitBreaker.RecordFailure(snapshot.ProcessId);
            return ValueTask.FromResult(Fail(SightlineErrorCode.UiaUnavailable, "UI Automation could not verify keyboard focus."));
        }
    }

    private static FocusReceipt Fail(SightlineErrorCode code, string detail) =>
        new(false, code, detail);
}
