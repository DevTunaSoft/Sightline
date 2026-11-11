using System.Globalization;
using System.Security.Cryptography;
using System.Runtime.InteropServices;

namespace Sightline.Core;

/// <summary>
/// In-memory, one-use approval for a single observed desktop mutation.
/// The trusted UI host must call ArmAfterUserConfirmation only after a real
/// user explicitly reviews the action; never call it from AI or page content.
/// Keeps only a SHA-256 digest and an expiry, not the action's typed value.
/// </summary>
public sealed class OneShotDesktopActionApproval : IDesktopActionApproval
{
    private readonly object _gate = new();
    private readonly Func<DateTimeOffset> _clock;
    private readonly TimeSpan _validFor;
    private byte[]? _fingerprint;
    private DateTimeOffset _issuedAt;
    private DateTimeOffset _expiresAt;

    public OneShotDesktopActionApproval(
        TimeSpan? validFor = null,
        Func<DateTimeOffset>? clock = null)
    {
        _validFor = validFor ?? TimeSpan.FromMinutes(2);
        if (_validFor <= TimeSpan.Zero || _validFor > TimeSpan.FromMinutes(5))
            throw new ArgumentOutOfRangeException(nameof(validFor));
        _clock = clock ?? (() => DateTimeOffset.UtcNow);
    }

    /// <summary>
    /// Only a trusted UI confirmation event may arm this single pending action.
    /// A new confirmation invalidates any prior one; no timer or worker exists.
    /// </summary>
    public bool ArmAfterUserConfirmation(SemanticSnapshot snapshot, SemanticAction action)
    {
        var fingerprint = Fingerprint(snapshot, action);
        lock (_gate)
        {
            Clear();
            if (fingerprint is null) return false;
            try
            {
                _issuedAt = _clock();
                _expiresAt = _issuedAt.Add(_validFor);
                _fingerprint = fingerprint;
                return true;
            }
            catch
            {
                // A failed or untrusted clock must never leave an old ticket.
                CryptographicOperations.ZeroMemory(fingerprint);
                Clear();
                return false;
            }
        }
    }

    /// <summary>Consume a matching approval before the action can mutate UIA.</summary>
    public bool IsApproved(SemanticSnapshot snapshot, SemanticAction action)
    {
        lock (_gate)
        {
            if (_fingerprint is null) return false;
            DateTimeOffset now;
            try { now = _clock(); }
            catch
            {
                Clear();
                return false;
            }
            // Wall-clock adjustments cannot extend an approval indefinitely.
            if (now < _issuedAt || now >= _expiresAt)
            {
                Clear();
                return false;
            }

            var requested = Fingerprint(snapshot, action);
            if (requested is null) return false;
            try
            {
                if (!CryptographicOperations.FixedTimeEquals(_fingerprint, requested))
                    return false;
                Clear();
                return true;
            }
            finally
            {
                CryptographicOperations.ZeroMemory(requested);
            }
        }
    }

    public void Revoke()
    {
        lock (_gate) Clear();
    }

    private void Clear()
    {
        if (_fingerprint is not null)
            CryptographicOperations.ZeroMemory(_fingerprint);
        _fingerprint = null;
        _issuedAt = default;
        _expiresAt = default;
    }

    private static byte[]? Fingerprint(SemanticSnapshot? snapshot, SemanticAction? action)
    {
        if (snapshot is null || action is null ||
            !DesktopActionValidation.IsValid(action) ||
            snapshot.Truncated || snapshot.ProcessId <= 0 || snapshot.WindowHandle == 0 ||
            string.IsNullOrWhiteSpace(snapshot.SnapshotId) || snapshot.SnapshotId.Length > 128 ||
            snapshot.Elements is null || snapshot.Elements.Count > 10_000)
            return null;

        SemanticElement? target = null;
        foreach (var element in snapshot.Elements)
        {
            if (!string.Equals(element.Ref, action.Ref, StringComparison.Ordinal)) continue;
            if (target is not null) return null; // Duplicate refs are ambiguous.
            target = element;
        }
        if (target is null || !target.IsEnabled ||
            string.IsNullOrWhiteSpace(target.ControlType) || target.ControlType.Length > 128 ||
            target.Name?.Length > 256 || target.AutomationId?.Length > 128)
            return null;

        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
        Append(hash, "SightlineDesktopApprovalV1");
        Append(hash, snapshot.SnapshotId);
        Append(hash, snapshot.ProcessId.ToString(CultureInfo.InvariantCulture));
        Append(hash, snapshot.WindowHandle.ToString(CultureInfo.InvariantCulture));
        Append(hash, snapshot.CapturedAt.ToUniversalTime().Ticks.ToString(CultureInfo.InvariantCulture));
        Append(hash, target.Ref);
        Append(hash, target.Name);
        Append(hash, target.AutomationId);
        Append(hash, target.ControlType);
        Append(hash, target.Depth.ToString(CultureInfo.InvariantCulture));
        Append(hash, action.Kind.ToString());
        Append(hash, action.Value);
        return hash.GetHashAndReset();
    }

    private static void Append(IncrementalHash hash, string? value)
    {
        // Hash the exact UTF-16 code units in place. This avoids temporary
        // plaintext buffers and preserves differences between malformed
        // surrogate sequences that UTF-8 replacement would otherwise collapse.
        Span<byte> length = stackalloc byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteInt32LittleEndian(
            length, value is null ? -1 : value.Length);
        hash.AppendData(length);
        if (value is not null)
            hash.AppendData(MemoryMarshal.AsBytes(value.AsSpan()));
    }
}
