using System.Globalization;
using System.Text;

namespace Sightline.Core;

/// <summary>
/// Write-ahead safeguard for one desktop mutation at a time. A pending record
/// blocks all later mutations, including after process restart. No input values
/// or observed field text are written. A trusted caller must independently
/// verify an effect before clearing its record.
/// </summary>
public interface IDesktopMutationJournal
{
    bool TryBegin(SemanticSnapshot snapshot, SemanticAction action);
    bool TryCompleteVerified();
    void PreserveUnknown();
}

/// <summary>
/// Small, synchronous, write-through, create-new journal. It never queues actions,
/// runs background work, or holds an unbounded history in RAM.
/// </summary>
public sealed class FileDesktopMutationJournal : IDesktopMutationJournal, IDisposable
{
    private readonly string _path;
    private readonly object _gate = new();
    private FileStream? _pendingStream;

    public FileDesktopMutationJournal(string pendingFilePath)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(pendingFilePath);
        if (!Path.IsPathFullyQualified(pendingFilePath))
            throw new ArgumentException("Journal path must be fully qualified.", nameof(pendingFilePath));
        _path = Path.GetFullPath(pendingFilePath);
    }

    public bool HasPending => File.Exists(_path);

    public bool TryBegin(SemanticSnapshot snapshot, SemanticAction action)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(action);
        if (!DesktopActionValidation.IsValid(action)) return false;
        lock (_gate)
        {
            if (_pendingStream is not null || File.Exists(_path)) return false;
            FileStream? opened = null;
            try
            {
                // CreateNew is atomic across processes. An old unresolved record
                // is never silently overwritten, even after a crash.
                opened = new FileStream(_path, FileMode.CreateNew, FileAccess.Write,
                    FileShare.None, bufferSize: 4096, options: FileOptions.WriteThrough);
                var record = string.Join('\n',
                    "sightline-mutation-v1",
                    "process=" + snapshot.ProcessId.ToString(CultureInfo.InvariantCulture),
                    "window=" + snapshot.WindowHandle.ToString(CultureInfo.InvariantCulture),
                    // Use a fresh record ID: even observed element labels,
                    // snapshot identifiers and refs may contain private text.
                    "record-id=" + Guid.NewGuid().ToString("N"),
                    "kind=" + action.Kind,
                    "timestamp=" + DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture),
                    "");
                var bytes = Encoding.UTF8.GetBytes(record);
                opened.Write(bytes);
                opened.Flush(flushToDisk: true);
                _pendingStream = opened;
                return true;
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                // Preserve even a partially written file: unknown means no retry.
                opened?.Dispose();
                return false;
            }
        }
    }

    /// <summary>
    /// Clear only after verified UIA readback or separate trusted application
    /// evidence. Returns false on any failure; never assumes deletion succeeded.
    /// </summary>
    public bool TryCompleteVerified()
    {
        lock (_gate)
        {
            _pendingStream?.Dispose();
            _pendingStream = null;
            try
            {
                if (!File.Exists(_path)) return false;
                File.Delete(_path);
                return !File.Exists(_path);
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException)
            {
                return false;
            }
        }
    }

    public void PreserveUnknown()
    {
        lock (_gate)
        {
            _pendingStream?.Dispose();
            _pendingStream = null;
            // The file intentionally survives disposal and process restarts.
        }
    }

    public void Dispose() => PreserveUnknown();

}
