namespace Sightline.Windows;

/// <summary>
/// Observation-time locator metadata. AutomationId alone is not a unique identity.
/// Require every available stable field to match at resolution and reject empty
/// identifiers instead of guessing an actionable desktop control.
/// </summary>
public sealed record WindowsElementLocator(
    string? AutomationId,
    string? Name,
    string ControlType,
    bool IsSensitive = false)
{
    public bool IsIdentifiable =>
        !string.IsNullOrWhiteSpace(ControlType) &&
        (!string.IsNullOrWhiteSpace(AutomationId) || !string.IsNullOrWhiteSpace(Name));

    public bool Matches(string? automationId, string? name, string? controlType) =>
        IsIdentifiable &&
        string.Equals(ControlType, controlType, StringComparison.Ordinal) &&
        (string.IsNullOrWhiteSpace(AutomationId) ||
            string.Equals(AutomationId, automationId, StringComparison.Ordinal)) &&
        (string.IsNullOrWhiteSpace(Name) ||
            string.Equals(Name, name, StringComparison.Ordinal));
}
