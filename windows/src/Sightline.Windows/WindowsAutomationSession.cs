using Sightline.Core;

namespace Sightline.Windows;

public sealed class WindowsAutomationSession
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly UiaCircuitBreaker _circuitBreaker;

    public WindowsAutomationSession(
        int leaseCapacity = 1024,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null)
    {
        _leases = new ElementLeaseRegistry<WindowsElementLocator>(leaseCapacity);
        _circuitBreaker = new UiaCircuitBreaker();
        var options = runtimeOptions ?? UiaRuntimeOptions.Default;
        options.Validate();
        Observer = new FlaUiDesktopObserver(_leases, options, _circuitBreaker);
        Actions = new FlaUiActionExecutor(_leases, resolutionBudget, options, _circuitBreaker);
        Focus = new FlaUiFocusVerifier(_leases, resolutionBudget, options, _circuitBreaker);
        UserActivity = new Win32UserActivityDetector();
    }

    public IDesktopObserver Observer { get; }
    public IDesktopActionExecutor Actions { get; }
    public IDesktopFocusVerifier Focus { get; }
    public IUserActivityDetector UserActivity { get; }
    public int LeaseCapacity => _leases.Capacity;
}
