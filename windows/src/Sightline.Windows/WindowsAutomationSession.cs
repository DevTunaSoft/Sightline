using Sightline.Core;

namespace Sightline.Windows;

public sealed class WindowsAutomationSession : IAsyncDisposable
{
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly UiaCircuitBreaker _circuitBreaker;

    public WindowsAutomationSession(
        int leaseCapacity = 1024,
        ObservationBudget? resolutionBudget = null,
        UiaRuntimeOptions? runtimeOptions = null,
        DiagnosticFileOptions? diagnosticFileOptions = null)
    {
        _leases = new ElementLeaseRegistry<WindowsElementLocator>(leaseCapacity);
        _circuitBreaker = new UiaCircuitBreaker();
        Diagnostics = new DiagnosticRecorder(256, diagnosticFileOptions);
        var options = runtimeOptions ?? UiaRuntimeOptions.Default;
        options.Validate();
        Observer = new FlaUiDesktopObserver(_leases, options, _circuitBreaker, Diagnostics);
        Actions = new FlaUiActionExecutor(_leases, resolutionBudget, options, _circuitBreaker, Diagnostics);
        Focus = new FlaUiFocusVerifier(_leases, resolutionBudget, options, _circuitBreaker, Diagnostics);
        UserActivity = new Win32UserActivityDetector();
        WindowDiscovery = Win32WindowDiscovery.Instance;
    }

    public IDesktopObserver Observer { get; }
    public IDesktopActionExecutor Actions { get; }
    public IDesktopFocusVerifier Focus { get; }
    public IUserActivityDetector UserActivity { get; }
    public IDesktopWindowDiscovery WindowDiscovery { get; }
    public DiagnosticRecorder Diagnostics { get; }
    public int LeaseCapacity => _leases.Capacity;

    public ValueTask DisposeAsync() => Diagnostics.DisposeAsync();
}
