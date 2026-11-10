using System.Text.Json;
using Sightline.Core;
using Sightline.Windows;

if (args.Length == 1 && args[0] == "--resource")
{
    Console.WriteLine(JsonSerializer.Serialize(ProcessResourceSampler.CaptureCurrent()));
    return 0;
}

if (args.Length == 1 && args[0] == "--resource-session")
{
    var before = ProcessResourceSampler.CaptureCurrent();
    await using var idleSession = new WindowsAutomationSession();
    var withSession = ProcessResourceSampler.CaptureCurrent();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        Before = before,
        WithSession = withSession,
        Delta = new
        {
            WorkingSetBytes = withSession.WorkingSetBytes - before.WorkingSetBytes,
            PrivateMemoryBytes = withSession.PrivateMemoryBytes - before.PrivateMemoryBytes,
            HandleCount = withSession.HandleCount - before.HandleCount,
            ThreadCount = withSession.ThreadCount - before.ThreadCount
        }
    }));
    return 0;
}

if (args.Length != 2 || args[0] != "--observe" || !int.TryParse(args[1], out var processId))
{
    Console.WriteLine("Sightline Windows Foundation v0");
    Console.WriteLine("Usage: Sightline.App --observe <process-id> | --resource | --resource-session");
    return 2;
}

try
{
    await using var session = new WindowsAutomationSession();
    var snapshot = await session.Observer.ObserveAsync(processId, new ObservationBudget());
    Console.WriteLine($"Snapshot {snapshot.SnapshotId}: {snapshot.Elements.Count} elements; truncated={snapshot.Truncated}");
    foreach (var element in snapshot.Elements.Take(25))
        Console.WriteLine($"{element.Ref} depth={element.Depth} {element.ControlType} {element.Name}");
    return 0;
}
catch (Exception ex)
{
    Console.Error.WriteLine($"Observation failed: {ex.GetType().Name}: {ex.Message}");
    return 1;
}
