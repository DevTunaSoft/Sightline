using Sightline.Core;
using Sightline.Windows;
using Xunit;

namespace Sightline.Windows.Tests;

public sealed class WindowDiscoveryTests
{
    [Fact]
    public void Options_reject_unbounded_values()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new WindowDiscoveryOptions(MaxWindows: 0).Validate());

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new WindowDiscoveryOptions(MaxWindows: 1025).Validate());

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new WindowDiscoveryOptions(MaxTitleChars: 0).Validate());

        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new WindowDiscoveryOptions(MaxTitleChars: 2049).Validate());
    }

    [Fact]
    public void Discovery_is_bounded_and_title_limited()
    {
        IDesktopWindowDiscovery discovery = new Win32WindowDiscovery();
        var windows = discovery.Discover(new WindowDiscoveryOptions(
            MaxWindows: 32,
            MaxTitleChars: 64,
            VisibleOnly: false,
            IncludeUntitled: true));

        Assert.InRange(windows.Count, 0, 32);
        Assert.All(windows, item =>
        {
            Assert.True(item.Handle != 0);
            Assert.True(item.ProcessId > 0);
            Assert.InRange(item.Title.Length, 0, 64);
        });
    }

    [Fact]
    public void Visible_only_discovery_never_reports_hidden_windows()
    {
        IDesktopWindowDiscovery discovery = new Win32WindowDiscovery();
        var windows = discovery.Discover(new WindowDiscoveryOptions(
            MaxWindows: 32,
            MaxTitleChars: 64,
            VisibleOnly: true,
            IncludeUntitled: true));

        Assert.All(windows, item => Assert.True(item.IsVisible));
    }
}
