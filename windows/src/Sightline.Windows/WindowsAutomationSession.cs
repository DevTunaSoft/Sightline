using Sightline.Core;

namespace Sightline.Windows;

public sealed class WindowsAutomationSession
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;

    public WindowsAutomationSession(
        int leaseCapacity = 1024,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null)
    {
        _leases = new ElementLeaseRegistry<WindowsElementLocator>(leaseCapacity);
        var options = runtimeOptions ?? UiaRuntimeOptions.Default;
        options.Validate();
        Observer = new FlaUiDesktopObserver(_leases, options);
        Actions = new FlaUiActionExecutor(_leases, resolutionBudget, options);
        Focus = new FlaUiFocusVerifier(_leases, resolutionBudget, options);
    }

    public IDesktopObserver Observer { get; }
    public IDesktopActionExecutor Actions { get; }
    public IDesktopFocusVerifier Focus { get; }
    public int LeaseCapacity => _leases.Capacity;
}
