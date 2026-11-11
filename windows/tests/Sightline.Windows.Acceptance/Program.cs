using System.Diagnostics;
using Sightline.Core;
using Sightline.Windows;

if (args.Length != 1 || !File.Exists(args[0]))
{
    Console.Error.WriteLine("Usage: Sightline.Windows.Acceptance <path-to-test-target.exe>");
    return 2;
}

using var cancellation = new CancellationTokenSource(TimeSpan.FromSeconds(15));
using var process = Process.Start(new ProcessStartInfo(args[0]) { UseShellExecute = true });
if (process is null)
{
    Console.Error.WriteLine("FAIL: could not launch test target.");
    return 3;
}

try
{
    try { process.WaitForInputIdle(5000); } catch { }

    // Disposable fixture only. Production must use a stable, access-restricted
    // per-user journal location so unresolved mutations survive process restart.
    using var journal = new FileDesktopMutationJournal(
        Path.Combine(Path.GetTempPath(), "sightline-acceptance-" + Guid.NewGuid().ToString("N") + ".pending"));
    await using var session = new WindowsAutomationSession(
        leaseCapacity: 256,
        resolutionBudget: new ObservationBudget(256, 20, TimeSpan.FromMilliseconds(750)),
        actionApproval: new TestTargetApproval(process.Id),
        actionJournal: journal);

    var snapshot = await ObserveUntilAsync(
        session.Observer,
        process.Id,
        s => Find(s, "InputBox") is not null && Find(s, "ApplyButton") is not null,
        cancellation.Token);

    var input = Require(snapshot, "InputBox");
    var setReceipt = await session.Actions.ExecuteAsync(
        snapshot,
        new SemanticAction(SemanticActionKind.SetValue, input.Ref, "SightlineAcceptance"),
        cancellation.Token);

    // The field was verified in-process but its value must never be exposed
    // through an action receipt, even in a controlled acceptance fixture.
    if (!setReceipt.Ok || !setReceipt.Verified || setReceipt.Readback is not null)
        throw new InvalidOperationException("SetValue verification or readback privacy failed.");

    snapshot = await ObserveUntilAsync(
        session.Observer,
        process.Id,
        s => Find(s, "ApplyButton") is not null,
        cancellation.Token);

    var apply = Require(snapshot, "ApplyButton");
    var invokeReceipt = await session.Actions.ExecuteAsync(
        snapshot,
        new SemanticAction(SemanticActionKind.Invoke, apply.Ref),
        cancellation.Token);

    if (!invokeReceipt.Ok)
        throw new InvalidOperationException("Invoke was rejected.");

    snapshot = await ObserveUntilAsync(
        session.Observer,
        process.Id,
        s => string.Equals(Find(s, "ResultText")?.Name, "Applied:SightlineAcceptance", StringComparison.Ordinal),
        cancellation.Token);

    // Invoke is not self-verifying. The fixture's ResultText above supplies
    // independent application evidence before clearing the pending record.
    if (!journal.TryCompleteVerified())
        throw new InvalidOperationException("Externally verified Invoke record could not be reconciled.");

    Console.WriteLine($"PASS: observed {snapshot.Elements.Count} bounded elements and verified SetValue -> Invoke -> result readback.");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"FAIL: {ex.GetType().Name}: {ex.Message}");
    return 1;
}
finally
{
    try
    {
        if (!process.HasExited)
        {
            process.CloseMainWindow();
            if (!process.WaitForExit(1500))
                process.Kill(entireProcessTree: true);
        }
    }
    catch { }
}

static SemanticElement? Find(SemanticSnapshot snapshot, string automationId) =>
    snapshot.Elements.FirstOrDefault(e =>
        string.Equals(e.AutomationId, automationId, StringComparison.Ordinal));

static SemanticElement Require(SemanticSnapshot snapshot, string automationId) =>
    Find(snapshot, automationId) ??
    throw new InvalidOperationException($"Required test element '{automationId}' was not observed.");

static async Task<SemanticSnapshot> ObserveUntilAsync(
    IDesktopObserver observer,
    int processId,
    Func<SemanticSnapshot, bool> predicate,
    CancellationToken cancellationToken)
{
    Exception? lastError = null;
    for (var attempt = 0; attempt < 20; attempt++)
    {
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var snapshot = await observer.ObserveAsync(
                processId,
                new ObservationBudget(256, 20, TimeSpan.FromMilliseconds(750)),
                cancellationToken);

            if (predicate(snapshot))
                return snapshot;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            lastError = ex;
        }

        await Task.Delay(100, cancellationToken);
    }

    throw new InvalidOperationException("Timed out waiting for deterministic test state.", lastError);
}

sealed class TestTargetApproval(int processId) : IDesktopActionApproval
{
    // Only the dedicated disposable WPF fixture may be modified.
    // Production Sightline intentionally has no default approval policy.
    public bool IsApproved(SemanticSnapshot snapshot, SemanticAction action)
    {
        if (snapshot.ProcessId != processId || snapshot.WindowHandle == 0 || snapshot.Truncated)
            return false;
        var target = snapshot.Elements.SingleOrDefault(e => e.Ref == action.Ref);
        if (target is null || !target.IsEnabled)
            return false;
        return (action.Kind == SemanticActionKind.SetValue &&
                target.AutomationId == "InputBox" && action.Value == "SightlineAcceptance") ||
               (action.Kind == SemanticActionKind.Invoke && target.AutomationId == "ApplyButton");
    }
}
