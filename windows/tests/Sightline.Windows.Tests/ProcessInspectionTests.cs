using System.Diagnostics;
using System.Runtime.InteropServices;
using Sightline.Core;
using Sightline.Windows;
using Xunit;

namespace Sightline.Windows.Tests;

// The handle and thread counts measured below are process-wide. xUnit runs collections in
// parallel by default, so other test classes could change the counts during the loop. This
// collection runs alone. The bounds are unchanged; this only isolates the measurement (X-15).
[CollectionDefinition(SerialProcessMeasurements.Name, DisableParallelization = true)]
public sealed class SerialProcessMeasurements
{
    public const string Name = "Serial process measurements";
}

[Collection(SerialProcessMeasurements.Name)]
public sealed class ProcessInspectionTests
{
    [Fact]
    public void Current_process_is_available_without_retaining_process_object()
    {
        var processId = Environment.ProcessId;
        IDesktopProcessInspector inspector = WindowsProcessInspector.Instance;

        var result = inspector.Inspect(processId);

        Assert.Equal(ProcessInspectionStatus.Available, result.Status);
        Assert.NotNull(result.Process);
        Assert.Equal(processId, result.Process.ProcessId);
        Assert.False(result.Process.HasExited);
        Assert.False(string.IsNullOrWhiteSpace(result.Process.Name));
    }

    [Fact]
    public void Invalid_process_id_returns_not_found_without_throwing()
    {
        IDesktopProcessInspector inspector = WindowsProcessInspector.Instance;

        var result = inspector.Inspect(0);

        Assert.Equal(ProcessInspectionStatus.NotFound, result.Status);
        Assert.Null(result.Process);
    }

    [Fact]
    public void Missing_process_id_returns_stable_status_without_throwing()
    {
        IDesktopProcessInspector inspector = WindowsProcessInspector.Instance;

        var result = inspector.Inspect(int.MaxValue);

        Assert.Contains(
            result.Status,
            new[] { ProcessInspectionStatus.NotFound, ProcessInspectionStatus.Unavailable });
        Assert.Null(result.Process);
    }

    [Fact]
    public void Repeated_current_process_inspection_does_not_accumulate_handles_or_threads()
    {
        var inspector = WindowsProcessInspector.Instance;

        for (var i = 0; i < 50; i++)
            Assert.Equal(ProcessInspectionStatus.Available, inspector.Inspect(Environment.ProcessId).Status);

        using var current = Process.GetCurrentProcess();
        var beforeThreads = current.Threads.Count;
        var beforeHandles = CurrentHandleCount();

        for (var i = 0; i < 500; i++)
            Assert.Equal(ProcessInspectionStatus.Available, inspector.Inspect(Environment.ProcessId).Status);

        var afterHandles = CurrentHandleCount();
        current.Refresh();
        var afterThreads = current.Threads.Count;

        RecordMeasurement(beforeHandles, afterHandles, beforeThreads, afterThreads);

        Assert.InRange((long)afterHandles - beforeHandles, -1, 1);
        Assert.InRange(afterThreads - beforeThreads, -1, 1);
    }

    // Writes the measured deltas only when GITHUB_WORKSPACE is set (CI). A workflow step prints
    // the file, so the values appear in the job log (X-15). Locally this does nothing.
    private static void RecordMeasurement(uint beforeHandles, uint afterHandles, int beforeThreads, int afterThreads)
    {
        var workspace = Environment.GetEnvironmentVariable("GITHUB_WORKSPACE");
        if (string.IsNullOrEmpty(workspace))
            return;

        var line = $"handles {beforeHandles} -> {afterHandles} (delta {(long)afterHandles - beforeHandles}); " +
                   $"threads {beforeThreads} -> {afterThreads} (delta {afterThreads - beforeThreads}){Environment.NewLine}";
        System.IO.File.AppendAllText(
            System.IO.Path.Combine(workspace, "windows", "process-handle-delta.txt"),
            line);
    }

    private static uint CurrentHandleCount()
    {
        Assert.True(GetProcessHandleCount(GetCurrentProcess(), out var count));
        return count;
    }

    [DllImport("kernel32.dll")]
    private static extern nint GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetProcessHandleCount(nint process, out uint handleCount);
}
