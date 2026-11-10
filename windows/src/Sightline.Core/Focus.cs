namespace Sightline.Core;

public sealed record FocusReceipt(
    bool Ok,
    SightlineErrorCode? ErrorCode,
    string? Detail = null);

public interface IDesktopFocusVerifier
{
    ValueTask<FocusReceipt> FocusAndVerifyAsync(
        SemanticSnapshot snapshot,
        string elementRef,
        CancellationToken cancellationToken = default);
}
