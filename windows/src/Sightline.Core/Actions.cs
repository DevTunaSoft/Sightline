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
/// Converts UIA ValuePattern readback into a verification-only receipt.
/// Never return the observed or requested text to callers or diagnostics.
/// A SetValue operation already ran, so a mismatch is an UNKNOWN effect,
/// not proof that retrying the mutation is safe.
/// </summary>
public static class DesktopValueVerification
{
    public static ActionReceipt FromReadback(string requestedValue, string? observedValue)
    {
        ArgumentNullException.ThrowIfNull(requestedValue);
        var verified = string.Equals(requestedValue, observedValue, StringComparison.Ordinal);
        return new ActionReceipt(
            Ok: verified,
            ErrorCode: verified ? null : SightlineErrorCode.UnknownEffect,
            Verified: verified,
            Readback: null,
            Detail: verified
                ? "Value readback matched."
                : "SetValue returned uncertain state; reconcile before retry.");
    }
}

/// <summary>
/// An accepted UIA method call is not proof that the intended effect occurred.
/// When a durable mutation record remains unresolved, never report success or
/// expose a field value; the application must reconcile the effect before retry.
/// </summary>
public static class DesktopMutationOutcome
{
    public static ActionReceipt RequireVerifiedEffect(ActionReceipt providerReceipt)
    {
        ArgumentNullException.ThrowIfNull(providerReceipt);
        if (providerReceipt.Ok && providerReceipt.Verified)
            return providerReceipt with { Readback = null };
        return new ActionReceipt(
            Ok: false,
            ErrorCode: SightlineErrorCode.UnknownEffect,
            Verified: false,
            Readback: null,
            Detail: "Action effect is unverified; reconcile before retry.");
    }
}

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

/// <summary>
/// Trusted host approval boundary. Approval must bind the observed window,
/// target and action and be invalidated when state changes. A null provider
/// means denial; page content and AI output must never grant approval.
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
