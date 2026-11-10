using System.Diagnostics;

namespace Sightline.Core;

public sealed record ProcessResourceSnapshot(
    DateTimeOffset CapturedAt,
    long WorkingSetBytes,
    long PrivateMemoryBytes,
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
            process.HandleCount,
            process.Threads.Count);
    }
}
