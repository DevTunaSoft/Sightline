using System.ComponentModel;
using System.Runtime.InteropServices;
using Sightline.Core;

namespace Sightline.Windows;

public sealed class Win32UserActivityDetector : IUserActivityDetector
{
    public UserActivityStamp Capture()
    {
        var info = new LastInputInfo
        {
            CbSize = checked((uint)Marshal.SizeOf<LastInputInfo>())
        };

        if (!GetLastInputInfo(ref info))
            throw new Win32Exception(Marshal.GetLastWin32Error());

        return new UserActivityStamp(info.DwTime);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct LastInputInfo
    {
        public uint CbSize;
        public uint DwTime;
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GetLastInputInfo(ref LastInputInfo info);
}
