using System.Text.RegularExpressions;

namespace Sightline.Core;

public static partial class DiagnosticSanitizer
{
    private static readonly Regex SecretAssignment = new(
        @"(?i)\b(password|passwd|token|api[_-]?key|secret)\s*[:=]\s*[^\s,;]+",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    private static readonly Regex BearerToken = new(
        @"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+",
        RegexOptions.CultureInvariant | RegexOptions.NonBacktracking);

    public static DiagnosticEvent Sanitize(DiagnosticEvent item, int maxDetailChars = 1000)
    {
        ArgumentNullException.ThrowIfNull(item);
        if (maxDetailChars is < 64 or > 16_384)
            throw new ArgumentOutOfRangeException(nameof(maxDetailChars));

        return item with
        {
            Level = CleanMetadata(item.Level, 16),
            EventName = CleanMetadata(item.EventName, 80),
            TaskId = item.TaskId is null ? null : CleanMetadata(item.TaskId, 128),
            Detail = SanitizeDetail(item.Detail, maxDetailChars)
        };
    }

    public static string? SanitizeDetail(string? value, int maxChars = 1000)
    {
        if (value is null)
            return null;
        if (maxChars is < 64 or > 16_384)
            throw new ArgumentOutOfRangeException(nameof(maxChars));

        var normalized = value
            .Replace('\r', ' ')
            .Replace('\n', ' ')
            .Replace('\0', ' ')
            .Trim();

        if (normalized.Length > maxChars)
            normalized = normalized[..maxChars];

        normalized = BearerToken.Replace(normalized, "Bearer [REDACTED]");
        normalized = SecretAssignment.Replace(normalized, match =>
        {
            var separator = match.Value.Contains('=') ? "=" : ":";
            var name = match.Groups[1].Value;
            return $"{name}{separator}[REDACTED]";
        });

        return normalized;
    }

    private static string CleanMetadata(string value, int maxChars)
    {
        var cleaned = string.IsNullOrWhiteSpace(value) ? "unknown" : value.Trim();
        return cleaned.Length <= maxChars ? cleaned : cleaned[..maxChars];
    }
}
