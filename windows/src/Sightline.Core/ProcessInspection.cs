namespace Sightline.Core;

public enum ProcessInspectionStatus
{
    Available,
    NotFound,
    AccessDenied,
    Unavailable
}

public sealed record DesktopProcessInfo(
    int ProcessId,
    string Name,
    long MainWindowHandle,
    bool HasExited);

public sealed record ProcessInspectionResult(
    ProcessInspectionStatus Status,
    DesktopProcessInfo? Process,
    string? Detail = null);

public interface IDesktopProcessInspector
{
    ProcessInspectionResult Inspect(int processId);
}
