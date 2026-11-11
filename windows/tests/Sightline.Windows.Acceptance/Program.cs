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
    var approval = new OneShotDesktopActionApproval(TimeSpan.FromSeconds(30));
    await using var session = new WindowsAutomationSession(
        leaseCapacity: 256,
        resolutionBudget: new ObservationBudget(256, 20, TimeSpan.FromMilliseconds(750)),
        actionApproval: approval,
        actionJournal: journal);

    var snapshot = await ObserveUntilAsync(
        session.Observer,
        process.Id,
        s => Find(s, "InputBox") is not null && Find(s, "ApplyButton") is not null,
        cancellation.Token);

    var input = Require(snapshot, "InputBox");
    var setAction = new SemanticAction(SemanticActionKind.SetValue, input.Ref, "SightlineAcceptance");
    ArmTestFixtureApproval(approval, snapshot, setAction, process.Id, "InputBox");
    var setReceipt = await session.Actions.ExecuteAsync(
        snapshot, setAction, cancellation.Token);
    if (approval.IsApproved(snapshot, setAction))
        throw new InvalidOperationException("SetValue confirmation was reused.");

    // The field was verified in-process but its value must never be exposed
    // through an action receipt, even in a controlled acceptance fixture.
    if (!setReceipt.Ok || !setReceipt.Verified || setReceipt.Readback is not null)
        throw new InvalidOperationException("SetValue verification or readback privacy failed.");
    if (journal.HasPending)
        throw new InvalidOperationException("Verified SetValue must clear its durable record.");

    snapshot = await ObserveUntilAsync(
        session.Observer,
        process.Id,
        s => Find(s, "ApplyButton") is not null,
        cancellation.Token);

    var apply = Require(snapshot, "ApplyButton");
    var invokeAction = new SemanticAction(SemanticActionKind.Invoke, apply.Ref);
    ArmTestFixtureApproval(approval, snapshot, invokeAction, process.Id, "ApplyButton");
    var invokeReceipt = await session.Actions.ExecuteAsync(
        snapshot, invokeAction, cancellation.Token);
    if (approval.IsApproved(snapshot, invokeAction))
        throw new InvalidOperationException("Invoke confirmation was reused.");

    // A provider accepting Invoke does not prove the intended application
    // effect. Sightline must fail closed until the fixture verifies ResultText.
    if (invokeReceipt.Ok || invokeReceipt.Verified ||
        invokeReceipt.ErrorCode != SightlineErrorCode.UnknownEffect)
        throw new InvalidOperationException("Unverified Invoke was incorrectly reported as successful.");
    if (!journal.HasPending)
        throw new InvalidOperationException("Unverified Invoke must retain its durable record.");

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

// Dedicated disposable fixture only. Production must call the same approval
// implementation from a real trusted confirmation UI, never from the model.
static void ArmTestFixtureApproval(
    OneShotDesktopActionApproval approval,
    SemanticSnapshot snapshot,
    SemanticAction action,
    int fixtureProcessId,
    string expectedAutomationId)
{
    var target = snapshot.Elements.SingleOrDefault(e => e.Ref == action.Ref);
    if (snapshot.ProcessId != fixtureProcessId || snapshot.Truncated ||
        snapshot.WindowHandle == 0 || target is null || !target.IsEnabled ||
        target.AutomationId != expectedAutomationId ||
        (action.Kind == SemanticActionKind.SetValue &&
         (expectedAutomationId != "InputBox" || action.Value != "SightlineAcceptance")) ||
        (action.Kind == SemanticActionKind.Invoke && expectedAutomationId != "ApplyButton") ||
        !approval.ArmAfterUserConfirmation(snapshot, action))
        throw new InvalidOperationException("Disposable fixture confirmation was rejected.");
}
