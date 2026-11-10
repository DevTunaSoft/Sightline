using System.Diagnostics;

namespace Sightline.Core;

public sealed record ProcessResourceSnapshot(
    DateTimeOffset CapturedAt,
    long WorkingSetBytes,
    long PrivateMemoryBytes,
    long ManagedHeapBytes,
    long TotalAllocatedBytes,
    int HandleCount,
    int ThreadCount);

public static class ProcessResourceSampler
{
    public static ProcessResourceSnapshot CaptureCurrent()
    {
        using var process = Process.GetCurrentProcess();
        process.Refresh();

        return new ProcessResourceSnapshot(
            DateTimeOffset.UtcNow,
            process.WorkingSet64,
            process.PrivateMemorySize64,
            GC.GetTotalMemory(forceFullCollection: false),
            GC.GetTotalAllocatedBytes(precise: false),
            process.HandleCount,
            process.Threads.Count);
    }
}
