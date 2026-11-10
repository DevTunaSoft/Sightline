using Sightline.Core;
using Xunit;

namespace Sightline.Core.Tests;

public sealed class FoundationTests
{
    private sealed record Node(string Name, Node[] Children);

    [Fact]
    public void Traversal_stops_at_node_budget()
    {
        var root = new Node("root", Enumerable.Range(0, 20)
            .Select(i => new Node($"child-{i}", Array.Empty<Node>())).ToArray());

        var walker = new BoundedTraversal<Node>();
        var result = walker.Walk(
            root,
            n => n.Children,
            new ObservationBudget(MaxNodes: 5, MaxDepth: 30, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None,
            out var truncated,
            out var reason);

        Assert.Equal(5, result.Count);
        Assert.True(truncated);
        Assert.Equal("nodes", reason);
    }

    [Fact]
    public void Traversal_honors_depth_budget()
    {
        var root = new Node("0", [new Node("1", [new Node("2", [])])]);
        var walker = new BoundedTraversal<Node>();

        var result = walker.Walk(
            root,
            n => n.Children,
            new ObservationBudget(MaxNodes: 20, MaxDepth: 1, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None,
            out _,
            out _);

        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, item => item.Node.Name == "2");
    }

    [Fact]
    public void Diagnostic_ledger_is_bounded_and_ordered()
    {
        var ledger = new BoundedDiagnosticLedger(16);
        for (var i = 0; i < 40; i++)
            ledger.Add(new DiagnosticEvent(DateTimeOffset.UtcNow, "INFO", $"event-{i}"));

        var snapshot = ledger.Snapshot();
        Assert.Equal(16, snapshot.Count);
        Assert.Equal("event-24", snapshot[0].EventName);
        Assert.Equal("event-39", snapshot[^1].EventName);
    }

    [Fact]
    public void Element_leases_reject_stale_snapshot_and_never_reuse_refs()
    {
        var leases = new ElementLeaseRegistry<string>(16);
        leases.BeginSnapshot("s1", 10, 20);
        var first = leases.Register("first");

        Assert.True(leases.TryResolve("s1", 10, 20, first, out var firstValue));
        Assert.Equal("first", firstValue);

        leases.BeginSnapshot("s2", 10, 20);
        var second = leases.Register("second");

        Assert.NotEqual(first, second);
        Assert.False(leases.TryResolve("s1", 10, 20, first, out _));
        Assert.False(leases.TryResolve("s2", 10, 99, second, out _));
        Assert.True(leases.TryResolve("s2", 10, 20, second, out var secondValue));
        Assert.Equal("second", secondValue);
        Assert.Equal(1, leases.Count);
    }

    [Fact]
    public void Element_lease_registry_is_hard_bounded()
    {
        var leases = new ElementLeaseRegistry<string>(16);
        leases.BeginSnapshot("s", 10, 20);

        for (var i = 0; i < 16; i++)
            leases.Register(i.ToString());

        var error = Assert.Throws<InvalidOperationException>(() => leases.Register("overflow"));
        Assert.Equal(SightlineErrorCode.ResourceLimitExceeded.ToString(), error.Message);
        Assert.Equal(16, leases.Count);
    }

    [Fact]
    public void Invalid_observation_budget_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ObservationBudget(MaxNodes: 0).Validate());
    }
}
