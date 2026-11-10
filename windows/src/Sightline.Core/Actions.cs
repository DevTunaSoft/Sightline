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
/// <summary>Reject malformed or oversized requests before any provider or approval call.</summary>
public static class DesktopActionValidation
{
    public const int MaxValueChars = 4000;
    public const int MaxRefChars = 128;

    public static bool IsValid(SemanticAction action)
    {
        if (!Enum.IsDefined(action.Kind))
            return false;
        if (string.IsNullOrWhiteSpace(action.Ref) || action.Ref.Length > MaxRefChars)
            return false;
        return action.Kind switch
        {
            SemanticActionKind.Invoke => action.Value is null,
            SemanticActionKind.SetValue => action.Value is not null && action.Value.Length <= MaxValueChars,
            _ => false
        };
    }
}

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
