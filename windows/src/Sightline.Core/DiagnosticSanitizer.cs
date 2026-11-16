using System.Text.RegularExpressions;

namespace Sightline.Core;

public static class DiagnosticSanitizer
{
    private static readonly Regex SecretAssignment = new(
        @"(?i)(?<prefix>\b(password|passwd|authorization|cookie|api[_-]?key|token|access[_-]?token|refresh[_-]?token|secret|mfa|otp)\b[""']?\s*[:=]\s*)(?:""(?<double>[^""]*)""|'(?<single>[^']*)'|(?<bare>[^\s,;}]+))",
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
            TaskId = CleanOptional(item.TaskId, 128),
            Step = CleanOptional(item.Step, 64),
            Capability = CleanOptional(item.Capability, 64),
            Operation = CleanOptional(item.Operation, 64),
            TargetRef = CleanOptional(item.TargetRef, 128),
            Result = CleanOptional(item.Result, 32),
            ErrorCode = CleanOptional(item.ErrorCode, 80),
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

        // Redact before truncating so a truncation boundary cannot preserve a partial secret.
        normalized = BearerToken.Replace(normalized, "Bearer [REDACTED]");
        normalized = SecretAssignment.Replace(normalized, match =>
        {
            var prefix = match.Groups["prefix"].Value;
            if (match.Groups["double"].Success) return $"{prefix}\"[REDACTED]\"";
            if (match.Groups["single"].Success) return $"{prefix}'[REDACTED]'";
            return $"{prefix}[REDACTED]";
        });

        return normalized.Length <= maxChars ? normalized : normalized[..maxChars];
    }

    private static string? CleanOptional(string? value, int maxChars) =>
        value is null ? null : CleanMetadata(value, maxChars);

    private static string CleanMetadata(string value, int maxChars)
    {
        var cleaned = string.IsNullOrWhiteSpace(value) ? "unknown" : value.Trim();
        return cleaned.Length <= maxChars ? cleaned : cleaned[..maxChars];
    }
}
