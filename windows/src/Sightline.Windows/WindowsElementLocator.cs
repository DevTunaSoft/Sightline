namespace Sightline.Windows;

public sealed record WindowsElementLocator(
    string? AutomationId,
    string? Name,
    string ControlType);
