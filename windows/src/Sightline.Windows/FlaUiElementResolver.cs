using FlaUI.Core.AutomationElements;
using FlaUI.UIA3;
using Sightline.Core;

namespace Sightline.Windows;

internal sealed class FlaUiElementResolver
{
    private readonly ObservationBudget _budget;

    public FlaUiElementResolver(ObservationBudget? budget = null)
    {
        _budget = budget ?? new ObservationBudget();
        _budget.Validate();
    }

    public AutomationElement? ResolveUnique(
        AutomationElement window,
        UIA3Automation automation,
        WindowsElementLocator locator,
        CancellationToken cancellationToken)
    {
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

        var nodes = new BoundedTraversal<AutomationElement>().Walk(
            window,
            Children,
            _budget,
            cancellationToken,
            out var truncated,
            out _);

        AutomationElement? match = null;
        foreach (var (candidate, _) in nodes)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (!Matches(candidate, locator))
                continue;

            if (match is not null)
                return null;

            match = candidate;
        }

        // A partial scan cannot establish uniqueness: an unseen matching control
        // could exist beyond the node/time/depth budget. Fail closed.
        return truncated ? null : match;
    }

    private static bool Matches(AutomationElement element, WindowsElementLocator locator)
    {
        var controlType = Safe(() => element.ControlType.ToString());
        if (!string.Equals(controlType, locator.ControlType, StringComparison.Ordinal))
            return false;

        if (!string.IsNullOrEmpty(locator.AutomationId))
        {
            return string.Equals(
                Safe(() => element.AutomationId),
                locator.AutomationId,
                StringComparison.Ordinal);
        }

        return !string.IsNullOrEmpty(locator.Name) &&
            string.Equals(Safe(() => element.Name), locator.Name, StringComparison.Ordinal);
    }

    private static string? Safe(Func<string?> read)
    {
        try { return read(); }
        catch { return null; }
    }
}
