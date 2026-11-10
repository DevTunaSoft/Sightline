using Sightline.Core;
using Sightline.Windows;
using Xunit;

namespace Sightline.Windows.Tests;

public sealed class ActionSafetyTests
{
    private static SemanticSnapshot Snapshot(string id, int processId = 42, long handle = 84) =>
        new(id, processId, handle, DateTimeOffset.UtcNow, Array.Empty<SemanticElement>(), false, null);

    [Fact]
    public async Task Stale_snapshot_is_rejected_before_live_process_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var elementRef = leases.Register(new WindowsElementLocator("ApplyButton", "Apply", "Button"));
        var executor = new FlaUiActionExecutor(leases);

        var receipt = await executor.ExecuteAsync(
            Snapshot("stale"),
            new SemanticAction(SemanticActionKind.Invoke, elementRef));

        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Equal(SightlineErrorCode.StateChanged, receipt.ErrorCode);
    }

    [Fact]
    public async Task Wrong_window_identity_is_rejected_before_live_process_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var elementRef = leases.Register(new WindowsElementLocator("ApplyButton", "Apply", "Button"));
        var executor = new FlaUiActionExecutor(leases);

        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh", handle: 999),
            new SemanticAction(SemanticActionKind.Invoke, elementRef));

        Assert.False(receipt.Ok);
        Assert.Equal(SightlineErrorCode.StateChanged, receipt.ErrorCode);
    }

    [Fact]
    public async Task Unknown_ref_is_rejected_before_live_process_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var executor = new FlaUiActionExecutor(leases);

        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"),
            new SemanticAction(SemanticActionKind.Invoke, "w:42:g1:e404"));

        Assert.False(receipt.Ok);
        Assert.Equal(SightlineErrorCode.StateChanged, receipt.ErrorCode);
    }

    [Fact]
    public async Task Focus_verifier_rejects_stale_ref_before_live_process_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var verifier = new FlaUiFocusVerifier(leases);

        var receipt = await verifier.FocusAndVerifyAsync(
            Snapshot("fresh"),
            "w:42:g1:e404");

        Assert.False(receipt.Ok);
        Assert.Equal(SightlineErrorCode.StateChanged, receipt.ErrorCode);
    }
}
