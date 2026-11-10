using Sightline.Core;
using Sightline.Windows;
using Xunit;

namespace Sightline.Windows.Tests;

public sealed class ActionSafetyTests
{
    private static SemanticSnapshot Snapshot(string id, int processId = 42, long handle = 84) =>
        new(id, processId, handle, DateTimeOffset.UtcNow, Array.Empty<SemanticElement>(), false, null);

    [Fact]
    public async Task Desktop_actions_deny_without_trusted_approval_before_provider_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var reference = leases.Register(new WindowsElementLocator("ApplyButton", "Apply", "Button"));
        var executor = new FlaUiActionExecutor(leases);
        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"),
            new SemanticAction(SemanticActionKind.Invoke, reference));
        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Equal(SightlineErrorCode.ConfirmationRequired, receipt.ErrorCode);
        Assert.Null(receipt.Readback);
    }

    [Fact]
    public async Task Unapproved_SetValue_must_not_echo_candidate_values()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var reference = leases.Register(new WindowsElementLocator("Message", "Message", "Edit"));
        await using var diagnostics = new DiagnosticRecorder(16);
        var executor = new FlaUiActionExecutor(leases, diagnostics: diagnostics);
        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"), new SemanticAction(SemanticActionKind.SetValue, reference, "synthetic-unique-value"));
        Assert.Equal(SightlineErrorCode.ConfirmationRequired, receipt.ErrorCode);
        Assert.Null(receipt.Readback);
        var exported = System.Text.Json.JsonSerializer.Serialize(diagnostics.Snapshot());
        Assert.DoesNotContain("synthetic-unique-value", exported);
    }

    [Fact]
    public async Task Explicitly_denied_action_is_blocked_before_provider_access()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var reference = leases.Register(new WindowsElementLocator("ApplyButton", "Apply", "Button"));
        var executor = new FlaUiActionExecutor(leases, approval: new DenyingApproval());
        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"), new SemanticAction(SemanticActionKind.Invoke, reference));
        Assert.Equal(SightlineErrorCode.ConfirmationRequired, receipt.ErrorCode);
    }

    private sealed class DenyingApproval : IDesktopActionApproval
    {
        public bool IsApproved(SemanticSnapshot snapshot, SemanticAction action) => false;
    }

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

    [Theory]
    [InlineData(SemanticActionKind.Invoke)]
    [InlineData(SemanticActionKind.SetValue)]
    public async Task Sensitive_leases_are_rejected_before_live_process_access(SemanticActionKind kind)
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var elementRef = leases.Register(new WindowsElementLocator(null, null, "Edit", IsSensitive: true));
        var executor = new FlaUiActionExecutor(leases);

        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"),
            new SemanticAction(kind, elementRef, "should-not-be-sent"));

        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Null(receipt.Readback);
        Assert.Equal(SightlineErrorCode.PermissionDenied, receipt.ErrorCode);
    }

    [Fact]
    public async Task Credential_named_controls_are_denied_before_provider_attach()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var elementRef = leases.Register(new WindowsElementLocator("new_password", "New password", "Edit"));
        var executor = new FlaUiActionExecutor(leases);

        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"),
            new SemanticAction(SemanticActionKind.SetValue, elementRef, "synthetic-value"));

        Assert.Equal(SightlineErrorCode.PermissionDenied, receipt.ErrorCode);
        Assert.Null(receipt.Readback);
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
    public async Task Action_diagnostics_never_capture_SetValue_text()
    {
        var leases = new ElementLeaseRegistry<WindowsElementLocator>(16);
        leases.BeginSnapshot("fresh", 42, 84);
        var diagnostics = new DiagnosticRecorder(16);
        var executor = new FlaUiActionExecutor(
            leases,
            diagnostics: diagnostics);

        const string secret = "private-value-8675309";
        var receipt = await executor.ExecuteAsync(
            Snapshot("fresh"),
            new SemanticAction(SemanticActionKind.SetValue, "w:42:g1:e404", secret));

        Assert.False(receipt.Ok);
        var exported = System.Text.Json.JsonSerializer.Serialize(diagnostics.Snapshot());
        Assert.DoesNotContain(secret, exported);
        Assert.Contains("SetValue", exported);
        await diagnostics.DisposeAsync();
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
    public void Uia_circuit_cancellation_releases_half_open_probe()
    {
        var now = DateTimeOffset.Parse("2026-11-10T00:00:00Z");
        var breaker = new UiaCircuitBreaker(
            new UiaCircuitBreakerOptions(MaxProcesses: 4, FailureThreshold: 1, Cooldown: TimeSpan.FromSeconds(1)),
            () => now);

        Assert.True(breaker.TryEnter(42));
        breaker.RecordFailure(42);
        now = now.AddSeconds(2);

        Assert.True(breaker.TryEnter(42));
        breaker.RecordNeutral(42);
        Assert.True(breaker.TryEnter(42));
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
    public async Task Idle_session_construction_allocation_stays_bounded()
    {
        const int warmup = 25;
        const int cycles = 250;
        const long maxBytesPerSession = 4096;

        for (var i = 0; i < warmup; i++)
        {
            await using var warm = new WindowsAutomationSession();
        }

        var sessions = new WindowsAutomationSession[cycles];
        var before = GC.GetAllocatedBytesForCurrentThread();

        for (var i = 0; i < cycles; i++)
            sessions[i] = new WindowsAutomationSession();

        var allocated = GC.GetAllocatedBytesForCurrentThread() - before;

        foreach (var session in sessions)
            await session.DisposeAsync();

        Assert.InRange(allocated, 0, maxBytesPerSession * cycles);
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
