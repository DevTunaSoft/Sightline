using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiDesktopObserver : IDesktopObserver
{
    private static long _snapshotSequence;
    private readonly ElementLeaseRegistry<WindowsElementLocator> _leases;
    private readonly UiaRuntimeOptions _runtimeOptions;

    public FlaUiDesktopObserver(
        ElementLeaseRegistry<WindowsElementLocator>? leases = null,
        UiaRuntimeOptions? runtimeOptions = null)
    {
        _leases = leases ?? new ElementLeaseRegistry<WindowsElementLocator>();
        _runtimeOptions = runtimeOptions ?? UiaRuntimeOptions.Default;
        _runtimeOptions.Validate();
    }

    public ElementLeaseRegistry<WindowsElementLocator> Leases => _leases;
    public ValueTask<SemanticSnapshot> ObserveAsync(
        int processId,
        ObservationBudget budget,
        CancellationToken cancellationToken = default)
    {
        budget.Validate();
        cancellationToken.ThrowIfCancellationRequested();
        var effectiveBudget = budget.MaxNodes <= _leases.Capacity
            ? budget
            : budget with { MaxNodes = _leases.Capacity };

        using var application = Application.Attach(processId);
        using var automation = FlaUiAutomationFactory.Create(_runtimeOptions);
        var window = application.GetMainWindow(automation)
            ?? throw new InvalidOperationException(SightlineErrorCode.WindowNotFound.ToString());

        var walker = automation.TreeWalkerFactory.GetControlViewWalker();
        IEnumerable<AutomationElement> Children(AutomationElement parent)
        {
            var child = walker.GetFirstChild(parent);
            while (child is not null)
            {
                yield return child;
                child = walker.GetNextSibling(child);
            }
        }

        var traversal = new BoundedTraversal<AutomationElement>();
        var nodes = traversal.Walk(
            window,
            Children,
            effectiveBudget,
            cancellationToken,
            out var truncated,
            out var reason);

        var handle = window.Properties.NativeWindowHandle.ValueOrDefault;
        var snapshotId = $"ws:{processId}:{Interlocked.Increment(ref _snapshotSequence)}";
        _leases.BeginSnapshot(snapshotId, processId, handle);

        var elements = new List<SemanticElement>(nodes.Count);
        foreach (var (node, depth) in nodes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            var name = Safe(() => node.Name);
            var automationId = Safe(() => node.AutomationId);
            var controlType = Safe(() => node.ControlType.ToString()) ?? "Unknown";
            var elementRef = _leases.Register(new WindowsElementLocator(automationId, name, controlType));

            elements.Add(new SemanticElement(
                Ref: elementRef,
                Name: name,
                AutomationId: automationId,
                ControlType: controlType,
                IsEnabled: Safe(() => node.IsEnabled, false),
                Depth: depth));
        }

        return ValueTask.FromResult(new SemanticSnapshot(
            SnapshotId: snapshotId,
            ProcessId: processId,
            WindowHandle: handle,
            CapturedAt: DateTimeOffset.UtcNow,
            Elements: elements,
            Truncated: truncated,
            TruncationReason: reason));
    }

    private static string? Safe(Func<string?> read)
    {
        try { return read(); }
        catch { return null; }
    }

    private static bool Safe(Func<bool> read, bool fallback)
    {
        try { return read(); }
        catch { return fallback; }
    }
}
