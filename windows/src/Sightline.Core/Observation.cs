using System.Diagnostics;

namespace Sightline.Core;

public sealed record ObservationBudget(
    int MaxNodes = 750,
    int MaxDepth = 30,
    TimeSpan? MaxDuration = null)
{
    public TimeSpan Duration => MaxDuration ?? TimeSpan.FromMilliseconds(600);

    public void Validate()
    {
        if (MaxNodes is < 1 or > 10_000) throw new ArgumentOutOfRangeException(nameof(MaxNodes));
        if (MaxDepth is < 1 or > 128) throw new ArgumentOutOfRangeException(nameof(MaxDepth));
        if (Duration <= TimeSpan.Zero || Duration > TimeSpan.FromSeconds(10))
            throw new ArgumentOutOfRangeException(nameof(MaxDuration));
    }
}

public sealed record SemanticElement(
    string Ref,
    string? Name,
    string? AutomationId,
    string ControlType,
    bool IsEnabled,
    int Depth);

public sealed record SemanticSnapshot(
    string SnapshotId,
    int ProcessId,
    long WindowHandle,
    DateTimeOffset CapturedAt,
    IReadOnlyList<SemanticElement> Elements,
    bool Truncated,
    string? TruncationReason);

public interface IDesktopObserver
{
    ValueTask<SemanticSnapshot> ObserveAsync(
        int processId,
        ObservationBudget budget,
        CancellationToken cancellationToken = default);
}

public enum SightlineErrorCode
{
    WindowNotFound,
    ControlNotActionable,
    StateChanged,
    UserInterrupted,
    ResourceLimitExceeded,
    VerificationFailed,
    PermissionDenied,
    UiaUnavailable,
    ConfirmationRequired,
    UnknownEffect
}

public sealed class BoundedTraversal<T>
{
    public IReadOnlyList<(T Node, int Depth)> Walk(
        T root,
        Func<T, IEnumerable<T>> children,
        ObservationBudget budget,
        CancellationToken cancellationToken,
        out bool truncated,
        out string? truncationReason)
    {
        ArgumentNullException.ThrowIfNull(root);
        ArgumentNullException.ThrowIfNull(children);
        budget.Validate();

        var result = new List<(T, int)>(Math.Min(budget.MaxNodes, 256));
        var queue = new Queue<(T Node, int Depth)>();
        queue.Enqueue((root, 0));
        var stopwatch = Stopwatch.StartNew();
        truncated = false;
        truncationReason = null;

        while (queue.Count > 0)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (stopwatch.Elapsed >= budget.Duration)
            {
                truncated = true;
                truncationReason = "duration";
                break;
            }

            var current = queue.Dequeue();
            result.Add(current);

            if (result.Count >= budget.MaxNodes)
            {
                // Exhausting the node budget cannot prove the tree is complete.
                truncated = true;
                truncationReason = "nodes";
                break;
            }

            if (current.Depth >= budget.MaxDepth)
            {
                // A leaf precisely at the depth limit is completely observed.
                // Probe only for the existence of one child without adding it
                // to the queue. Actual deeper descendants still fail closed.
                cancellationToken.ThrowIfCancellationRequested();
                using var probe = children(current.Node).GetEnumerator();
                if (probe.MoveNext())
                {
                    truncated = true;
                    truncationReason ??= "depth";
                }
                continue;
            }

            foreach (var child in children(current.Node))
            {
                if (queue.Count + result.Count >= budget.MaxNodes)
                {
                    truncated = true;
                    truncationReason = "nodes";
                    break;
                }
                queue.Enqueue((child, current.Depth + 1));
            }

            // A full queue means more children existed than the budget permits.
            // Continue consuming already-admitted nodes; never grow the queue past MaxNodes.
            if (truncated && queue.Count == 0)
                break;
        }

        return result;
    }
}
