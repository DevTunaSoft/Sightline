using System.Diagnostics;
using System.Runtime.InteropServices;
using Sightline.Core;
using Sightline.Windows;
using Xunit;

namespace Sightline.Windows.Tests;

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

        Assert.InRange((long)afterHandles - beforeHandles, -1, 1);
        Assert.InRange(afterThreads - beforeThreads, -1, 1);
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
