using System.ComponentModel;
using System.Diagnostics;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class WindowsProcessInspector : IDesktopProcessInspector
{
    public static WindowsProcessInspector Instance { get; } = new();

    private WindowsProcessInspector()
    {
    }

    public ProcessInspectionResult Inspect(int processId)
    {
        if (processId <= 0)
            return new(ProcessInspectionStatus.NotFound, null, "Process id must be positive.");

        try
        {
            using var process = Process.GetProcessById(processId);
            process.Refresh();

            if (process.HasExited)
                return new(ProcessInspectionStatus.NotFound, null, "Process has exited.");

            return new(
                ProcessInspectionStatus.Available,
                new DesktopProcessInfo(
                    ProcessId: process.Id,
                    Name: process.ProcessName,
                    MainWindowHandle: process.MainWindowHandle.ToInt64(),
                    HasExited: false));
        }
        catch (ArgumentException)
        {
            return new(ProcessInspectionStatus.NotFound, null, "Process was not found.");
        }
        catch (InvalidOperationException)
        {
            return new(ProcessInspectionStatus.Unavailable, null, "Process state changed during inspection.");
        }
        catch (UnauthorizedAccessException)
        {
            return new(ProcessInspectionStatus.AccessDenied, null, "Access to process metadata was denied.");
        }
        catch (Win32Exception ex) when (ex.NativeErrorCode == 5)
        {
            return new(ProcessInspectionStatus.AccessDenied, null, "Access to process metadata was denied.");
        }
        catch (Win32Exception)
        {
            return new(ProcessInspectionStatus.Unavailable, null, "Windows could not read process metadata.");
        }
    }
}
