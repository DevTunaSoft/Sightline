using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class Win32WindowDiscovery : IDesktopWindowDiscovery
{
    public static Win32WindowDiscovery Instance { get; } = new();
    public IReadOnlyList<DesktopWindowInfo> Discover(WindowDiscoveryOptions? options = null)
    {
        var effective = options ?? new WindowDiscoveryOptions();
        effective.Validate();

        var results = new List<DesktopWindowInfo>(Math.Min(effective.MaxWindows, 64));
        var titleBuffer = new StringBuilder(effective.MaxTitleChars + 1);
        var stoppedByLimit = false;

        bool Callback(nint handle, nint lParam)
        {
            if (effective.VisibleOnly && !IsWindowVisible(handle))
                return true;

            GetWindowThreadProcessId(handle, out var processId);
            if (processId == 0 || processId > int.MaxValue)
                return true;

            titleBuffer.Clear();
            _ = GetWindowTextW(handle, titleBuffer, titleBuffer.Capacity);
            var title = titleBuffer.ToString();

            if (!effective.IncludeUntitled && title.Length == 0)
                return true;

            results.Add(new DesktopWindowInfo(
                Handle: handle.ToInt64(),
                ProcessId: checked((int)processId),
                Title: title,
                IsVisible: IsWindowVisible(handle),
                IsEnabled: IsWindowEnabled(handle)));

            if (results.Count < effective.MaxWindows)
                return true;

            stoppedByLimit = true;
            return false;
        }

        EnumWindowsProc callback = Callback;
        var completed = EnumWindows(callback, nint.Zero);
        GC.KeepAlive(callback);

        if (!completed && !stoppedByLimit)
            throw new Win32Exception(Marshal.GetLastWin32Error());

        return results;
    }

    private delegate bool EnumWindowsProc(nint hWnd, nint lParam);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, nint lParam);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowVisible(nint hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool IsWindowEnabled(nint hWnd);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(nint hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern int GetWindowTextW(nint hWnd, StringBuilder lpString, int nMaxCount);
}
