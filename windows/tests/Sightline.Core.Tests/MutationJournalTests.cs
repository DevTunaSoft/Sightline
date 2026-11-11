using Sightline.Core;
using Xunit;

namespace Sightline.Core.Tests;

public sealed class MutationJournalTests
{
    private static SemanticSnapshot Snapshot() =>
        new("snapshot-1", 42, 84, DateTimeOffset.UtcNow,
            Array.Empty<SemanticElement>(), false, null);

    private static SemanticAction Action(string text = "synthetic-private-value") =>
        new(SemanticActionKind.SetValue, "w:42:g1:e1", text);

    [Fact]
    public void Verified_action_clears_pending_record_and_allows_next_action()
    {
        WithJournal(path =>
        {
            using var journal = new FileDesktopMutationJournal(path);
            Assert.True(journal.TryBegin(Snapshot(), Action()));
            Assert.True(journal.HasPending);
            Assert.False(journal.TryBegin(Snapshot(), Action()));
            Assert.True(journal.TryCompleteVerified());
            Assert.False(journal.HasPending);
            Assert.True(journal.TryBegin(Snapshot(), Action("next")));
            Assert.True(journal.TryCompleteVerified());
        });
    }

    [Fact]
    public void Uncertain_action_survives_disposal_and_blocks_restart()
    {
        WithJournal(path =>
        {
            using (var first = new FileDesktopMutationJournal(path))
            {
                Assert.True(first.TryBegin(Snapshot(), Action()));
                first.PreserveUnknown();
            }

            using var restarted = new FileDesktopMutationJournal(path);
            Assert.True(restarted.HasPending);
            Assert.False(restarted.TryBegin(Snapshot(), Action("replayed")));
            // An external, trusted application check is required to reconcile.
            Assert.True(restarted.TryCompleteVerified());
            Assert.False(restarted.HasPending);
        });
    }

    [Fact]
    public void Stored_record_never_contains_typed_value_or_private_page_text()
    {
        WithJournal(path =>
        {
            const string secret = "private-canary-384837";
            using var journal = new FileDesktopMutationJournal(path);
            Assert.True(journal.TryBegin(
                Snapshot() with { SnapshotId = "snapshot\nprivate-canary-384837" },
                Action(secret)));
            journal.PreserveUnknown(); // Release file lock before inspection.
            var stored = File.ReadAllText(path);
            Assert.Contains("sightline-mutation-v1", stored);
            Assert.DoesNotContain(secret, stored);
            Assert.Contains("process=42", stored);
            Assert.Contains("kind=SetValue", stored);
        });
    }

    [Fact]
    public void Two_independent_journals_cannot_begin_the_same_mutation()
    {
        WithJournal(path =>
        {
            using var first = new FileDesktopMutationJournal(path);
            using var second = new FileDesktopMutationJournal(path);
            Assert.True(first.TryBegin(Snapshot(), Action()));
            Assert.False(second.TryBegin(Snapshot(), Action()));
            first.PreserveUnknown();
            Assert.False(second.TryBegin(Snapshot(), Action()));
        });
    }

    [Fact]
    public void Missing_journal_directory_fails_closed_without_creating_a_process()
    {
        WithJournal(path =>
        {
            using var journal = new FileDesktopMutationJournal(
                Path.Combine(Path.GetDirectoryName(path)!, "missing-directory", "pending"));
            Assert.False(journal.TryBegin(Snapshot(), Action()));
            Assert.False(journal.HasPending);
        });
    }

    [Fact]
    public void Relative_paths_are_rejected_before_any_write()
    {
        Assert.Throws<ArgumentException>(() => new FileDesktopMutationJournal("relative.pending"));
    }

    private static void WithJournal(Action<string> test)
    {
        var directory = Path.Combine(Path.GetTempPath(),
            "sightline-journal-test-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        try { test(Path.Combine(directory, "pending.txt")); }
        finally { Directory.Delete(directory, recursive: true); }
    }
}
