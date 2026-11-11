using Sightline.Core;
using Xunit;

namespace Sightline.Core.Tests;

public sealed class OneShotDesktopActionApprovalTests
{
    private static readonly DateTimeOffset Captured =
        DateTimeOffset.Parse("2026-11-11T12:00:00Z");

    private static SemanticSnapshot Snapshot(string id = "snapshot-1") =>
        new(id, 42, 84, Captured,
            [new SemanticElement("w:42:g1:e1", "Apply", "ApplyButton", "Button", true, 2)],
            false, null);

    private static SemanticAction Invoke() =>
        new(SemanticActionKind.Invoke, "w:42:g1:e1");

    [Fact]
    public void Action_is_denied_by_default_and_approved_only_once()
    {
        var approval = new OneShotDesktopActionApproval();
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), Invoke()));
        Assert.True(approval.IsApproved(Snapshot(), Invoke()));
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
    }

    [Fact]
    public void Action_approval_expires_without_a_timer()
    {
        var time = Captured;
        var approval = new OneShotDesktopActionApproval(
            TimeSpan.FromSeconds(30), () => time);
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), Invoke()));
        time = time.AddSeconds(31);
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
    }

    [Fact]
    public void Changed_snapshot_window_target_or_action_never_inherits_approval()
    {
        var approval = new OneShotDesktopActionApproval();
        var baseline = Snapshot();
        Assert.True(approval.ArmAfterUserConfirmation(baseline, Invoke()));
        Assert.False(approval.IsApproved(Snapshot("other-snapshot"), Invoke()));
        Assert.False(approval.IsApproved(baseline with { WindowHandle = 99 }, Invoke()));
        Assert.False(approval.IsApproved(baseline with { ProcessId = 99 }, Invoke()));
        Assert.False(approval.IsApproved(baseline with { CapturedAt = Captured.AddSeconds(1) }, Invoke()));
        Assert.False(approval.IsApproved(baseline with
        {
            Elements = [baseline.Elements[0] with { Name = "Delete" }]
        }, Invoke()));
        Assert.False(approval.IsApproved(baseline,
            new SemanticAction(SemanticActionKind.SetValue, Invoke().Ref, "new-value")));
        Assert.True(approval.IsApproved(baseline, Invoke()));
    }

    [Fact]
    public void Typed_value_is_bound_but_not_retained_as_plaintext()
    {
        var approval = new OneShotDesktopActionApproval();
        const string value = "synthetic-private-canary-4673";
        var action = new SemanticAction(SemanticActionKind.SetValue, Invoke().Ref, value);
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), action));
        Assert.False(approval.IsApproved(Snapshot(), action with { Value = "different" }));
        Assert.True(approval.IsApproved(Snapshot(), action));
        Assert.False(approval.IsApproved(Snapshot(), action));
    }

    [Fact]
    public void Incomplete_or_ambiguous_targets_cannot_be_approved()
    {
        var approval = new OneShotDesktopActionApproval();
        var baseline = Snapshot();
        Assert.False(approval.ArmAfterUserConfirmation(
            baseline with { Truncated = true }, Invoke()));
        Assert.False(approval.ArmAfterUserConfirmation(
            baseline with { Elements = [] }, Invoke()));
        Assert.False(approval.ArmAfterUserConfirmation(
            baseline with { Elements = [baseline.Elements[0], baseline.Elements[0]] },
            Invoke()));
        Assert.False(approval.ArmAfterUserConfirmation(
            baseline with { Elements = [baseline.Elements[0] with { IsEnabled = false }] },
            Invoke()));
        Assert.False(approval.IsApproved(baseline, Invoke()));
    }

    [Fact]
    public void Invalid_action_clears_a_previous_pending_approval()
    {
        var approval = new OneShotDesktopActionApproval();
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), Invoke()));
        Assert.False(approval.ArmAfterUserConfirmation(Snapshot(),
            new SemanticAction(SemanticActionKind.SetValue, Invoke().Ref, new string('x', 4001))));
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
    }

    [Fact]
    public async Task Concurrent_calls_can_consume_one_approval_only_once()
    {
        var approval = new OneShotDesktopActionApproval();
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), Invoke()));
        var tasks = Enumerable.Range(0, 20)
            .Select(_ => Task.Run(() => approval.IsApproved(Snapshot(), Invoke())));
        var results = await Task.WhenAll(tasks);
        Assert.Single(results.Where(accepted => accepted));
    }

    [Fact]
    public void Only_short_validity_periods_are_supported()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new OneShotDesktopActionApproval(TimeSpan.Zero));
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new OneShotDesktopActionApproval(TimeSpan.FromMinutes(6)));
    }

    [Fact]
    public void Revocation_blocks_subsequent_action()
    {
        var approval = new OneShotDesktopActionApproval();
        Assert.True(approval.ArmAfterUserConfirmation(Snapshot(), Invoke()));
        approval.Revoke();
        Assert.False(approval.IsApproved(Snapshot(), Invoke()));
    }
}
