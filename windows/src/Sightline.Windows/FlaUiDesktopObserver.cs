using FlaUI.Core;
using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class FlaUiDesktopObserver : IDesktopObserver
{
    public ValueTask<SemanticSnapshot> ObserveAsync(
        int processId,
        ObservationBudget budget,
        CancellationToken cancellationToken = default)
    {
        budget.Validate();
        cancellationToken.ThrowIfCancellationRequested();

        using var application = Application.Attach(processId);
        using var automation = new UIA3Automation();
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
            budget,
            cancellationToken,
            out var truncated,
            out var reason);

        var elements = new List<SemanticElement>(nodes.Count);
        var sequence = 0;
        foreach (var (node, depth) in nodes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            elements.Add(new SemanticElement(
                Ref: $"w:{processId}:e{++sequence}",
                Name: Safe(() => node.Name),
                AutomationId: Safe(() => node.AutomationId),
                ControlType: Safe(() => node.ControlType.ToString()) ?? "Unknown",
                IsEnabled: Safe(() => node.IsEnabled, false),
                Depth: depth));
        }

        var handle = window.Properties.NativeWindowHandle.ValueOrDefault;
        return ValueTask.FromResult(new SemanticSnapshot(
            SnapshotId: $"ws:{processId}:{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}",
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
