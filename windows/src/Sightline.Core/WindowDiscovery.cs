namespace Sightline.Core;

public sealed record WindowDiscoveryOptions(
    int MaxWindows = 128,
    int MaxTitleChars = 256,
    bool VisibleOnly = true,
    bool IncludeUntitled = false)
{
    public void Validate()
    {
        if (MaxWindows is < 1 or > 1024)
            throw new ArgumentOutOfRangeException(nameof(MaxWindows));
        if (MaxTitleChars is < 1 or > 2048)
            throw new ArgumentOutOfRangeException(nameof(MaxTitleChars));
    }
}

public sealed record DesktopWindowInfo(
    long Handle,
    int ProcessId,
    string Title,
    bool IsVisible,
    bool IsEnabled);

public interface IDesktopWindowDiscovery
{
    IReadOnlyList<DesktopWindowInfo> Discover(WindowDiscoveryOptions? options = null);
}
