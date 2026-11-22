using System.Diagnostics;
using System.Text.Json;
using Sightline.Core;
using Sightline.Windows;

// Run each scenario in its own process: the figures are indicative
// process-level measurements, not exact per-module memory ownership.
internal static class ComponentResourceProbe
{
    private const int WarmupIterations = 64;
    private const int MeasuredIterations = 1024;
    private const int SampleEvery = 64;

    private static readonly DiagnosticEvent SafeEvent =
        new(DateTimeOffset.UnixEpoch, "Info", "resource-probe");

    public static async Task<int> RunAsync(string component)
    {
        DiagnosticRecorder? recorder = null;
        Func<int> operation;

        switch (component)
        {
            case "diagnostics":
                recorder = new DiagnosticRecorder(256);
                var activeRecorder = recorder;
                operation = () =>
                {
                    activeRecorder.Record(SafeEvent);
                    return 1;
                };
                break;
            case "window-discovery":
                var discovery = Win32WindowDiscovery.Instance;
                var options = new WindowDiscoveryOptions(MaxWindows: 64, MaxTitleChars: 64);
                operation = () => discovery.Discover(options).Count;
                break;
            case "process-inspection":
                var inspector = WindowsProcessInspector.Instance;
                var pid = Environment.ProcessId;
                operation = () => inspector.Inspect(pid).Status == ProcessInspectionStatus.Available
                    ? 1
                    : throw new InvalidOperationException("Self-process inspection failed.");
                break;
            default:
                Console.Error.WriteLine("Unknown component. Use diagnostics, window-discovery, or process-inspection.");
                return 2;
        }

        try
        {
            for (var i = 0; i < WarmupIterations; i++)
                _ = operation();

            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();

            var start = ProcessResourceSampler.CaptureCurrent();
            var peakWorkingSet = start.WorkingSetBytes;
            var peakPrivateMemory = start.PrivateMemoryBytes;
            var peakHandles = start.HandleCount;
            var peakThreads = start.ThreadCount;
            var samples = new List<object>(MeasuredIterations / SampleEvery);
            long resultChecksum = 0;

            using var process = Process.GetCurrentProcess();
            process.Refresh();
            var cpuBefore = process.TotalProcessorTime;
            var timer = Stopwatch.StartNew();

            for (var iteration = 1; iteration <= MeasuredIterations; iteration++)
            {
                resultChecksum += operation();
                if (iteration % SampleEvery != 0)
                    continue;

                var sample = ProcessResourceSampler.CaptureCurrent();
                peakWorkingSet = Math.Max(peakWorkingSet, sample.WorkingSetBytes);
                peakPrivateMemory = Math.Max(peakPrivateMemory, sample.PrivateMemoryBytes);
                peakHandles = Math.Max(peakHandles, sample.HandleCount);
                peakThreads = Math.Max(peakThreads, sample.ThreadCount);
                samples.Add(new { Iteration = iteration, Memory = sample });
            }

            timer.Stop();
            process.Refresh();
            var cpuMs = (process.TotalProcessorTime - cpuBefore).TotalMilliseconds;
            var beforeFinalGc = ProcessResourceSampler.CaptureCurrent();
            peakWorkingSet = Math.Max(peakWorkingSet, beforeFinalGc.WorkingSetBytes);
            peakPrivateMemory = Math.Max(peakPrivateMemory, beforeFinalGc.PrivateMemoryBytes);
            peakHandles = Math.Max(peakHandles, beforeFinalGc.HandleCount);
            peakThreads = Math.Max(peakThreads, beforeFinalGc.ThreadCount);

            GC.Collect();
            GC.WaitForPendingFinalizers();
            GC.Collect();
            var afterFinalGc = ProcessResourceSampler.CaptureCurrent();

            Console.WriteLine(JsonSerializer.Serialize(new
            {
                Schema = 1,
                Component = component,
                WarmupIterations,
                MeasuredIterations,
                SampleEvery,
                ResultChecksum = resultChecksum,
                ElapsedMs = timer.Elapsed.TotalMilliseconds,
                CpuMs = cpuMs,
                Start = start,
                BeforeFinalGc = beforeFinalGc,
                AfterFinalGc = afterFinalGc,
                PeakSampled = new
                {
                    WorkingSetBytes = peakWorkingSet,
                    PrivateMemoryBytes = peakPrivateMemory,
                    HandleCount = peakHandles,
                    ThreadCount = peakThreads
                },
                Delta = new
                {
                    AllocatedBytes = beforeFinalGc.TotalAllocatedBytes - start.TotalAllocatedBytes,
                    RetainedPrivateBytes = afterFinalGc.PrivateMemoryBytes - start.PrivateMemoryBytes,
                    RetainedWorkingSetBytes = afterFinalGc.WorkingSetBytes - start.WorkingSetBytes,
                    RetainedManagedHeapBytes = afterFinalGc.ManagedHeapBytes - start.ManagedHeapBytes,
                    RetainedHandles = afterFinalGc.HandleCount - start.HandleCount,
                    RetainedThreads = afterFinalGc.ThreadCount - start.ThreadCount
                },
                Samples = samples
            }));

            return 0;
        }
        finally
        {
            if (recorder is not null)
                await recorder.DisposeAsync().ConfigureAwait(false);
        }
    }
}
