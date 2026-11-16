using Sightline.Core;
using Xunit;

namespace Sightline.Core.Tests;

public sealed class FoundationTests
{
    private sealed record Node(string Name, Node[] Children);

    [Fact]
    public void Traversal_stops_at_node_budget()
    {
        var root = new Node("root", Enumerable.Range(0, 20)
            .Select(i => new Node($"child-{i}", Array.Empty<Node>())).ToArray());

        var walker = new BoundedTraversal<Node>();
        var result = walker.Walk(
            root,
            n => n.Children,
            new ObservationBudget(MaxNodes: 5, MaxDepth: 30, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None,
            out var truncated,
            out var reason);

        Assert.Equal(5, result.Count);
        Assert.True(truncated);
        Assert.Equal("nodes", reason);
    }

    [Fact]
    public void Traversal_honors_depth_budget()
    {
        var root = new Node("0", [new Node("1", [new Node("2", [])])]);
        var walker = new BoundedTraversal<Node>();

        var result = walker.Walk(
            root,
            n => n.Children,
            new ObservationBudget(MaxNodes: 20, MaxDepth: 1, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None,
            out _,
            out _);

        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, item => item.Node.Name == "2");
    }

    [Fact]
    public void Depth_limited_scan_reports_incomplete_coverage()
    {
        var root = new Node("root", [new Node("child", [new Node("hidden", [])])]);
        var result = new BoundedTraversal<Node>().Walk(
            root, node => node.Children,
            new ObservationBudget(MaxNodes: 16, MaxDepth: 1, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None, out var truncated, out var reason);

        Assert.Equal(2, result.Count);
        Assert.True(truncated);
        Assert.Equal("depth", reason);
    }

    [Fact]
    public void A_leaf_exactly_at_maximum_depth_is_not_falsely_truncated()
    {
        var root = new Node("root", [new Node("leaf", [])]);
        var result = new BoundedTraversal<Node>().Walk(
            root, node => node.Children,
            new ObservationBudget(MaxNodes: 16, MaxDepth: 1, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None, out var truncated, out var reason);

        Assert.Equal(2, result.Count);
        Assert.False(truncated);
        Assert.Null(reason);
    }

    [Fact]
    public void Depth_boundary_probes_only_one_child_and_never_visits_hidden_descendants()
    {
        var hiddenVisits = 0;
        var root = new Node("root", [new Node("boundary", [new Node("hidden", [])])]);
        var result = new BoundedTraversal<Node>().Walk(
            root,
            node =>
            {
                if (node.Name == "hidden") hiddenVisits++;
                return node.Children;
            },
            new ObservationBudget(MaxNodes: 16, MaxDepth: 1, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None, out var truncated, out var reason);

        Assert.Equal(2, result.Count);
        Assert.Equal(0, hiddenVisits);
        Assert.True(truncated);
        Assert.Equal("depth", reason);
    }

    [Fact]
    public void Exact_node_budget_conservatively_reports_incomplete_coverage()
    {
        var root = new Node("root", Array.Empty<Node>());
        var result = new BoundedTraversal<Node>().Walk(
            root, node => node.Children,
            new ObservationBudget(MaxNodes: 1, MaxDepth: 2, MaxDuration: TimeSpan.FromSeconds(1)),
            CancellationToken.None, out var truncated, out var reason);

        Assert.Single(result);
        Assert.True(truncated);
        Assert.Equal("nodes", reason);
    }

    [Fact]
    public void Verified_SetValue_receipt_never_returns_input_or_observed_text()
    {
        const string syntheticValue = "synthetic-private-value-601";
        var receipt = DesktopValueVerification.FromReadback(syntheticValue, syntheticValue);

        Assert.True(receipt.Ok);
        Assert.True(receipt.Verified);
        Assert.Null(receipt.ErrorCode);
        Assert.Null(receipt.Readback);
        var exported = System.Text.Json.JsonSerializer.Serialize(receipt);
        Assert.DoesNotContain(syntheticValue, exported);
    }

    [Theory]
    [InlineData("different-value")]
    [InlineData("")]
    [InlineData(null)]
    public void Unmatched_SetValue_readback_is_unknown_and_never_disclosed(string? observed)
    {
        const string syntheticValue = "synthetic-private-value-602";
        var receipt = DesktopValueVerification.FromReadback(syntheticValue, observed);

        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Equal(SightlineErrorCode.UnknownEffect, receipt.ErrorCode);
        Assert.Null(receipt.Readback);
        Assert.Contains("reconcile", receipt.Detail!.ToLowerInvariant());

        var exported = System.Text.Json.JsonSerializer.Serialize(receipt);
        Assert.DoesNotContain(syntheticValue, exported);
        if (!string.IsNullOrEmpty(observed)) Assert.DoesNotContain(observed, exported);
    }

    [Fact]
    public void SetValue_verification_requires_non_null_request()
    {
        Assert.Throws<ArgumentNullException>(() => DesktopValueVerification.FromReadback(null!, "value"));
    }

    [Fact]
    public void Accepted_but_unverified_Invoke_cannot_be_reported_as_success()
    {
        var providerReceipt = new ActionReceipt(
            Ok: true, ErrorCode: null, Verified: false,
            Detail: "Provider returned without error.");
        var receipt = DesktopMutationOutcome.RequireVerifiedEffect(providerReceipt);

        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Equal(SightlineErrorCode.UnknownEffect, receipt.ErrorCode);
        Assert.Null(receipt.Readback);
        Assert.Contains("reconcile", receipt.Detail!.ToLowerInvariant());
    }

    [Fact]
    public void Unverified_outcome_does_not_echo_provider_private_text()
    {
        const string canary = "synthetic-application-field-secret-1201";
        var providerReceipt = new ActionReceipt(
            Ok: false, ErrorCode: SightlineErrorCode.VerificationFailed,
            Verified: false, Readback: canary, Detail: canary);
        var receipt = DesktopMutationOutcome.RequireVerifiedEffect(providerReceipt);
        Assert.Equal(SightlineErrorCode.UnknownEffect, receipt.ErrorCode);
        Assert.DoesNotContain(canary, System.Text.Json.JsonSerializer.Serialize(receipt));
    }

    [Fact]
    public void Verified_outcome_remains_successful_but_never_exposes_readback()
    {
        const string canary = "synthetic-application-field-secret-1202";
        var providerReceipt = new ActionReceipt(
            Ok: true, ErrorCode: null, Verified: true, Readback: canary, Detail: canary);
        var receipt = DesktopMutationOutcome.RequireVerifiedEffect(providerReceipt);
        Assert.True(receipt.Ok);
        Assert.True(receipt.Verified);
        Assert.Null(receipt.Readback);
        Assert.DoesNotContain(canary, System.Text.Json.JsonSerializer.Serialize(receipt));
    }

    [Fact]
    public void Contradictory_verified_status_with_error_code_is_not_trusted()
    {
        var providerReceipt = new ActionReceipt(
            Ok: true, ErrorCode: SightlineErrorCode.VerificationFailed, Verified: true);
        var receipt = DesktopMutationOutcome.RequireVerifiedEffect(providerReceipt);

        Assert.False(receipt.Ok);
        Assert.False(receipt.Verified);
        Assert.Equal(SightlineErrorCode.UnknownEffect, receipt.ErrorCode);
    }

    [Fact]
    public void Desktop_action_validation_rejects_unbounded_or_unsupported_requests()
    {
        Assert.True(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.Invoke, "w:42:g1:e1")));
        Assert.True(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.SetValue, "w:42:g1:e1", "test")));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.Invoke, "w:42:g1:e1", "unexpected")));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.SetValue, "w:42:g1:e1")));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.SetValue, "w:42:g1:e1",
            new string('X', DesktopActionValidation.MaxValueChars + 1))));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.Invoke, new string('w', DesktopActionValidation.MaxRefChars + 1))));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction(SemanticActionKind.Invoke, " ")));
        Assert.False(DesktopActionValidation.IsValid(new SemanticAction((SemanticActionKind)999, "w:42:g1:e1")));
    }

    [Theory]
    [InlineData(true, "Input", "NormalField", true)]
    [InlineData(false, "Password", "InputBox", true)]
    [InlineData(false, "Input", "new_password", true)]
    [InlineData(false, "Payment", "card-number", true)]
    [InlineData(false, "Shipping address", "AddressBox", false)]
    [InlineData(false, "Compass selector", "MappingPin", false)]
    [InlineData(false, "Search", "QueryBox", false)]
    public void Sensitive_control_metadata_is_classified_without_overblocking(
        bool isPassword, string name, string automationId, bool expected)
    {
        Assert.Equal(expected, SensitiveControlPolicy.IsSensitive(isPassword, name, automationId));
    }

    [Fact]
    public void Diagnostic_ledger_is_bounded_and_ordered()
    {
        var ledger = new BoundedDiagnosticLedger(16);
        for (var i = 0; i < 40; i++)
            ledger.Add(new DiagnosticEvent(DateTimeOffset.UtcNow, "INFO", $"event-{i}"));

        var snapshot = ledger.Snapshot();
        Assert.Equal(16, snapshot.Count);
        Assert.Equal("event-24", snapshot[0].EventName);
        Assert.Equal("event-39", snapshot[^1].EventName);
    }

    [Fact]
    public void Element_leases_reject_stale_snapshot_and_never_reuse_refs()
    {
        var leases = new ElementLeaseRegistry<string>(16);
        leases.BeginSnapshot("s1", 10, 20);
        var first = leases.Register("first");

        Assert.True(leases.TryResolve("s1", 10, 20, first, out var firstValue));
        Assert.Equal("first", firstValue);

        leases.BeginSnapshot("s2", 10, 20);
        var second = leases.Register("second");

        Assert.NotEqual(first, second);
        Assert.False(leases.TryResolve("s1", 10, 20, first, out _));
        Assert.False(leases.TryResolve("s2", 10, 99, second, out _));
        Assert.True(leases.TryResolve("s2", 10, 20, second, out var secondValue));
        Assert.Equal("second", secondValue);
        Assert.Equal(1, leases.Count);
    }

    [Fact]
    public void Element_lease_registry_is_hard_bounded()
    {
        var leases = new ElementLeaseRegistry<string>(16);
        leases.BeginSnapshot("s", 10, 20);

        for (var i = 0; i < 16; i++)
            leases.Register(i.ToString());

        var error = Assert.Throws<InvalidOperationException>(() => leases.Register("overflow"));
        Assert.Equal(SightlineErrorCode.ResourceLimitExceeded.ToString(), error.Message);
        Assert.Equal(16, leases.Count);
    }

    [Fact]
    public void Repeated_snapshot_cycles_do_not_accumulate_leases()
    {
        var leases = new ElementLeaseRegistry<string>(32);

        for (var cycle = 0; cycle < 1000; cycle++)
        {
            leases.BeginSnapshot($"s{cycle}", 10, 20);
            for (var i = 0; i < 16; i++)
                leases.Register($"{cycle}:{i}");

            Assert.Equal(16, leases.Count);
        }

        Assert.Equal(1000, leases.Generation);
        Assert.Equal(16, leases.Count);
    }

    [Fact]
    public void Resource_sampler_returns_bounded_process_counters()
    {
        var sample = ProcessResourceSampler.CaptureCurrent();

        Assert.True(sample.WorkingSetBytes > 0);
        Assert.True(sample.PrivateMemoryBytes > 0);
        Assert.True(sample.ManagedHeapBytes >= 0);
        Assert.True(sample.TotalAllocatedBytes >= sample.ManagedHeapBytes);
        Assert.True(sample.HandleCount >= 0);
        Assert.True(sample.ThreadCount > 0);
    }


    [Fact]
    public void User_activity_lease_invalidates_on_new_input_stamp()
    {
        var lease = new UserActivityLease(new UserActivityStamp(100));

        Assert.True(lease.IsStillValid(new UserActivityStamp(100)));
        Assert.False(lease.IsStillValid(new UserActivityStamp(101)));
    }


    [Fact]
    public void Diagnostic_sanitizer_redacts_secrets_and_caps_detail()
    {
        var item = new DiagnosticEvent(
            DateTimeOffset.UtcNow,
            "INFO",
            "auth",
            Detail: "password=hunter2 token:abc123 Authorization: Bearer abc.def.ghi " + new string('x', 400));

        var sanitized = DiagnosticSanitizer.Sanitize(item, 160);

        Assert.DoesNotContain("hunter2", sanitized.Detail);
        Assert.DoesNotContain("abc123", sanitized.Detail);
        Assert.DoesNotContain("abc.def.ghi", sanitized.Detail);
        Assert.Contains("[REDACTED]", sanitized.Detail);
        Assert.True(sanitized.Detail!.Length <= 160);
    }

    [Theory]
    [InlineData("{\"password\": \"canaryJson\"}", "canaryJson")]
    [InlineData("\"token\":\"canaryToken\"", "canaryToken")]
    [InlineData("password='canarySingle'", "canarySingle")]
    [InlineData("password : canaryPlain", "canaryPlain")]
    public void Diagnostic_sanitizer_redacts_quoted_and_unquoted_assignments(string input, string secret)
    {
        var result = DiagnosticSanitizer.SanitizeDetail(input);
        Assert.DoesNotContain(secret, result);
        Assert.Contains("[REDACTED]", result);
    }

    [Fact]
    public async Task Diagnostic_file_sink_rotates_with_fixed_retention_and_redaction()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"sightline-diag-{Guid.NewGuid():N}");
        try
        {
            await using (var sink = new BoundedDiagnosticFileSink(new DiagnosticFileOptions(
                directory,
                QueueCapacity: 128,
                MaxFileBytes: 4096,
                MaxFiles: 2,
                MaxDetailChars: 256)))
            {
                for (var i = 0; i < 100; i++)
                {
                    sink.TryWrite(new DiagnosticEvent(
                        DateTimeOffset.UtcNow,
                        "INFO",
                        "rotation-test",
                        TaskId: $"t{i}",
                        Detail: $"token=secret-{i} {new string('a', 180)}"));
                }
            }

            var files = Directory.GetFiles(directory, "sightline*.jsonl");
            Assert.InRange(files.Length, 1, 2);

            var combined = string.Join('\n', files.Select(File.ReadAllText));
            Assert.DoesNotContain("secret-", combined);
            Assert.Contains("[REDACTED]", combined);
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }


    [Fact]
    public void Diagnostic_file_options_reject_single_event_larger_than_file_budget()
    {
        var options = new DiagnosticFileOptions(
            Path.GetTempPath(),
            QueueCapacity: 16,
            MaxFileBytes: 4096,
            MaxFiles: 2,
            MaxDetailChars: 1000);

        Assert.Throws<ArgumentException>(() => options.Validate());
    }

    [Fact]
    public async Task Diagnostic_file_failure_is_isolated_from_application()
    {
        var root = Path.Combine(Path.GetTempPath(), $"sightline-diag-failure-{Guid.NewGuid():N}");
        File.WriteAllText(root, "not a directory");
        try
        {
            var sink = new BoundedDiagnosticFileSink(new DiagnosticFileOptions(
                root,
                QueueCapacity: 16,
                MaxFileBytes: 8192,
                MaxFiles: 2,
                MaxDetailChars: 256));

            _ = sink.TryWrite(new DiagnosticEvent(
                DateTimeOffset.UtcNow,
                "INFO",
                "failure-isolation",
                Detail: "safe"));

            await sink.DisposeAsync();
            Assert.NotNull(sink.LastFailure);
        }
        finally
        {
            if (File.Exists(root))
                File.Delete(root);
        }
    }


    [Fact]
    public async Task Diagnostic_file_sink_stays_bounded_under_rapid_load()
    {
        var directory = Path.Combine(Path.GetTempPath(), $"sightline-diag-stress-{Guid.NewGuid():N}");
        const int total = 10_000;
        var accepted = 0;

        try
        {
            var sink = new BoundedDiagnosticFileSink(new DiagnosticFileOptions(
                directory,
                QueueCapacity: 64,
                MaxFileBytes: 8192,
                MaxFiles: 3,
                MaxDetailChars: 256));

            for (var i = 0; i < total; i++)
            {
                if (sink.TryWrite(new DiagnosticEvent(
                    DateTimeOffset.UtcNow,
                    "INFO",
                    "stress",
                    TaskId: $"t{i}",
                    Detail: $"token=secret-{i} payload-{i}")))
                {
                    accepted++;
                }
            }

            await sink.DisposeAsync();

            Assert.Equal(total, accepted + sink.DroppedEvents);

            var files = Directory.GetFiles(directory, "sightline*.jsonl");
            Assert.InRange(files.Length, 1, 3);
            Assert.All(files, file => Assert.InRange(new FileInfo(file).Length, 1, 8192));

            var combined = string.Join('\n', files.Select(File.ReadAllText));
            Assert.DoesNotContain("secret-", combined);
        }
        finally
        {
            if (Directory.Exists(directory))
                Directory.Delete(directory, recursive: true);
        }
    }

    [Fact]
    public async Task Diagnostic_recorder_keeps_only_sanitized_bounded_events()
    {
        await using var recorder = new DiagnosticRecorder(16);

        for (var i = 0; i < 40; i++)
        {
            recorder.Record(new DiagnosticEvent(
                DateTimeOffset.UtcNow,
                "INFO",
                "uia.action",
                Capability: "Windows.UIAutomation",
                Operation: "SetValue",
                TargetRef: $"w:10:g1:e{i}",
                Result: "VERIFIED",
                Detail: $"password=secret-{i} process=10"));
        }

        var snapshot = recorder.Snapshot();
        Assert.Equal(16, snapshot.Count);
        Assert.Equal("w:10:g1:e24", snapshot[0].TargetRef);
        Assert.Equal("w:10:g1:e39", snapshot[^1].TargetRef);
        Assert.All(snapshot, item => Assert.DoesNotContain("secret-", item.Detail));
    }

    [Fact]
    public void Invalid_observation_budget_is_rejected()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() =>
            new ObservationBudget(MaxNodes: 0).Validate());
    }
}
