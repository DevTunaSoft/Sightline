# Windows 11 component resource profiling

**Stage:** instrumentation only. No measured results are claimed by this document.

## Objective

Identify which *currently implemented* Sightline Windows operations cause avoidable process memory allocations, retained memory, handle/thread growth or high CPU before considering Native AOT, native code or a Rust rewrite. Keep the existing .NET/FlaUI automation path and security guarantees intact.

## Existing measurements (preserved)

- `--resource` samples the application process.
- `--resource-session` compares process metrics before and after creating an automation session.
- `--resource-soak` performs 100 warm-up and 1,000 repeated sessions.
- `npm run benchmark:core` measures synthetic browser snapshot bounding and diagnostic events; **this is not Chrome/Edge process RAM**.

## Added isolated component probes

Build and run on Windows 11 (64-bit, .NET 8 SDK), or use the opt-in GitHub Actions Windows job artifacts.

```text
dotnet windows/src/Sightline.App/bin/Release/net8.0-windows/Sightline.App.dll --component-resource diagnostics
dotnet windows/src/Sightline.App/bin/Release/net8.0-windows/Sightline.App.dll --component-resource window-discovery
dotnet windows/src/Sightline.App/bin/Release/net8.0-windows/Sightline.App.dll --component-resource process-inspection
```

Each command runs in its own process. It executes 64 warm-up operations, then 1,024 measured operations with 64-iteration sampling. JSON includes elapsed and CPU time, working set/private bytes, managed heap, total managed allocation delta, handle/thread counts and before/after full-GC metrics. **This has zero continuous-production polling** and only runs when explicitly invoked.

- `diagnostics`: bounded in-memory sanitized logging.
- `window-discovery`: bounded native EnumWindows enumeration.
- `process-inspection`: on-demand inspection of the benchmark process itself.

These are first-pass microbenchmarks, **not** side-by-side application component ownership measurements. Working set and private bytes overlap across components and include CLR/runtime/JIT overhead. Sampled peaks can miss brief spikes. Forced GC at the end is a **testing aid only** and does not represent normal app operation. CPU and allocation measurements can include the sampler; they are comparative indicators, not isolated call costs.

## Analysis and promotion criteria

1. Compare repeated runs with the same OS, .NET version, configuration, and idle environment; account for warm-up and run-to-run noise.
2. Inspect per-iteration allocations, retained private bytes and handle/thread slopes, not just peak working set. Distinguish expected CLR initialization from growth due to the component.
3. Measure actual Chrome/Edge tab and extension processes, future capture/vision pipeline, and **full Windows app** separately; do not attribute browser/model process memory to C# without evidence.
4. Reproduce a hotspot with a targeted profiler before changing its implementation. Prefer eliminating copies, retaining fewer snapshots, reusing buffers, lazy initialization, event-driven lifecycles and unloading expensive optional subsystems.
5. Evaluate Rust or Native AOT only after establishing comparable feature/safety behavior, Windows 11 end-to-end tests, packaging compatibility, and repeatable net savings after integration overhead. Treat failed AOT compatibility as a blocker rather than bypassing reflection or safety.
6. Keep this profiling opt-in so normal startup, background CPU and working set are unaffected.

## Acceptance

- Windows CI builds and runs the three probes without changing existing tests: **NOT RUN at authoring**.
- Per-component JSON emitted as downloadable CI evidence: **NOT RUN at authoring**.
- Windows 11 desktop interactive acceptance: **UNVERIFIED**.
- Browser-extension, AI/vision and live desktop full-system memory profiling: **NOT IMPLEMENTED**.
- No production Rust migration authorized by benchmark numbers alone.

Update this status with the exact commit/run IDs and measured data after CI and representative Windows 11 execution.
