using System.Text.Json;
using Sightline.Core;
using Sightline.Windows;

if (args.Length == 1 && args[0] == "--resource")
{
    Console.WriteLine(JsonSerializer.Serialize(ProcessResourceSampler.CaptureCurrent()));
    return 0;
}

if (args.Length == 1 && args[0] == "--resource-soak")
{
    const int cycles = 100;
    const int sampleEvery = 10;
    var start = ProcessResourceSampler.CaptureCurrent();
    var samples = new List<object>(cycles / sampleEvery);

    long peakWorkingSet = start.WorkingSetBytes;
    long peakPrivateMemory = start.PrivateMemoryBytes;
    var peakHandles = start.HandleCount;
    var peakThreads = start.ThreadCount;

    for (var i = 1; i <= cycles; i++)
    {
        await using (var session = new WindowsAutomationSession())
        {
            // Foundation soak intentionally performs no UIA work. It measures
            // repeated construction/disposal cost without requiring a desktop.
        }

        if (i % sampleEvery != 0)
            continue;

        var sample = ProcessResourceSampler.CaptureCurrent();
        peakWorkingSet = Math.Max(peakWorkingSet, sample.WorkingSetBytes);
        peakPrivateMemory = Math.Max(peakPrivateMemory, sample.PrivateMemoryBytes);
        peakHandles = Math.Max(peakHandles, sample.HandleCount);
        peakThreads = Math.Max(peakThreads, sample.ThreadCount);
        samples.Add(new { Cycle = i, Sample = sample });
    }

    var end = ProcessResourceSampler.CaptureCurrent();
    Console.WriteLine(JsonSerializer.Serialize(new
    {
        Cycles = cycles,
        SampleEvery = sampleEvery,
        Start = start,
        End = end,
        Peak = new
        {
            WorkingSetBytes = peakWorkingSet,
            PrivateMemoryBytes = peakPrivateMemory,
            HandleCount = peakHandles,
            ThreadCount = peakThreads
        },
        Delta = new
        {
            WorkingSetBytes = end.WorkingSetBytes - start.WorkingSetBytes,
            PrivateMemoryBytes = end.PrivateMemoryBytes - start.PrivateMemoryBytes,
            HandleCount = end.HandleCount - start.HandleCount,
            ThreadCount = end.ThreadCount - start.ThreadCount
        },
        Samples = samples
    }));
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
    Console.WriteLine("Usage: Sightline.App --observe <process-id> | --resource | --resource-session | --resource-soak");
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
