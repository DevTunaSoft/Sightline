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

    [Fact]
    public void Uia_circuit_opens_after_threshold_and_allows_one_probe_after_cooldown()
    {
        var now = DateTimeOffset.Parse("2026-11-10T00:00:00Z");
        var breaker = new UiaCircuitBreaker(
            new UiaCircuitBreakerOptions(MaxProcesses: 4, FailureThreshold: 2, Cooldown: TimeSpan.FromSeconds(5)),
            () => now);

        Assert.True(breaker.TryEnter(42));
        breaker.RecordFailure(42);
        Assert.True(breaker.TryEnter(42));
        breaker.RecordFailure(42);
        Assert.False(breaker.TryEnter(42));

        now = now.AddSeconds(6);
        Assert.True(breaker.TryEnter(42));
        Assert.False(breaker.TryEnter(42));

        breaker.RecordFailure(42);
        Assert.False(breaker.TryEnter(42));

        now = now.AddSeconds(6);
        Assert.True(breaker.TryEnter(42));
        breaker.RecordSuccess(42);
        Assert.True(breaker.TryEnter(42));
        Assert.Equal(0, breaker.TrackedProcessCount);
    }

    [Fact]
    public void Uia_circuit_process_table_is_hard_bounded()
    {
        var breaker = new UiaCircuitBreaker(
            new UiaCircuitBreakerOptions(MaxProcesses: 2, FailureThreshold: 3, Cooldown: TimeSpan.FromSeconds(5)));

        breaker.RecordFailure(1);
        breaker.RecordFailure(2);
        breaker.RecordFailure(3);

        Assert.Equal(2, breaker.TrackedProcessCount);
    }

    [Fact]
    public void Uia_runtime_options_reject_unbounded_or_tiny_timeouts()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new UiaRuntimeOptions(TimeSpan.FromMilliseconds(100), TimeSpan.FromSeconds(10)).Validate());

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new UiaRuntimeOptions(TimeSpan.FromSeconds(2), TimeSpan.FromMinutes(5)).Validate());

        UiaRuntimeOptions.Default.Validate();
    }
}
