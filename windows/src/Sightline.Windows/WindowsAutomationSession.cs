using Sightline.Core;

namespace Sightline.Windows;

public sealed class WindowsAutomationSession
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;

    public WindowsAutomationSession(
        int leaseCapacity = 1024,
        ObservationBudget? resolutionBudget = null)
    {
        _leases = new ElementLeaseRegistry<WindowsElementLocator>(leaseCapacity);
        Observer = new FlaUiDesktopObserver(_leases);
        Actions = new FlaUiActionExecutor(_leases, resolutionBudget);
    }

    public IDesktopObserver Observer { get; }
    public IDesktopActionExecutor Actions { get; }
    public int LeaseCapacity => _leases.Capacity;
}
