using System.Text.RegularExpressions;

namespace Sightline.Core;

/// <summary>Fail-closed classification of credential/payment controls. Metadata only; never inspect values.</summary>
public static partial class SensitiveControlPolicy
{
    [GeneratedRegex(
        @"(?i)(?:^|[^a-z0-9])(?:password|passwd|passcode|passphrase|pin|otp|mfa|cvv|cvc|security[\s_-]*code|card[\s_-]*number|credit[\s_-]*card|access[\s_-]*token|secret[\s_-]*key)(?:$|[^a-z0-9])",
        RegexOptions.CultureInvariant)]
    private static partial Regex SensitiveNames();

    public static bool IsSensitive(bool isPassword, string? name, string? automationId) =>
        isPassword || SensitiveNames().IsMatch(name ?? string.Empty) ||
        SensitiveNames().IsMatch(automationId ?? string.Empty);
}
