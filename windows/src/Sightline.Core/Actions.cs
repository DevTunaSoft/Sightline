namespace Sightline.Core;

public enum SemanticActionKind
{
    Invoke,
    SetValue
}

public sealed record SemanticAction(
    SemanticActionKind Kind,
    string Ref,
    string? Value = null);

public sealed record ActionReceipt(
    bool Ok,
    SightlineErrorCode? ErrorCode,
    bool Verified,
    string? Readback = null,
    string? Detail = null);

/// <summary>
/// Trusted host confirmation boundary. The production host must bind approval to
/// the exact observed window, target and action and invalidate it on state changes.
/// A null implementation is deny-by-default. Page/model text must never approve.
/// </summary>
public interface IDesktopActionApproval
{
    bool IsApproved(SemanticSnapshot snapshot, SemanticAction action);
}

public interface IDesktopActionExecutor
{
    ValueTask<ActionReceipt> ExecuteAsync(
        SemanticSnapshot snapshot,
        SemanticAction action,
        CancellationToken cancellationToken = default);
}
