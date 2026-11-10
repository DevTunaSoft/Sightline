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

public interface IDesktopActionExecutor
{
    ValueTask<ActionReceipt> ExecuteAsync(
        SemanticSnapshot snapshot,
        SemanticAction action,
        CancellationToken cancellationToken = default);
}
