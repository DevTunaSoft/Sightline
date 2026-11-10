param(
    [ValidateSet("Debug", "Release")]
    [string]$Configuration = "Release",
    [string]$EvidenceDir = ".artifacts/windows-foundation",
    [switch]$Interactive
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = Split-Path -Parent $PSScriptRoot
$solution = Join-Path $root "windows/Sightline.Windows.sln"
$evidence = Join-Path $root $EvidenceDir
New-Item -ItemType Directory -Force -Path $evidence | Out-Null

$started = [DateTimeOffset]::UtcNow
$status = [ordered]@{
    schema = 1
    startedAt = $started
    configuration = $Configuration
    restore = "NOT RUN"
    build = "NOT RUN"
    coreTests = "NOT RUN"
    windowsSafetyTests = "NOT RUN"
    resourceProbe = "NOT RUN"
    interactiveAcceptance = "NOT RUN"
}

try {
    dotnet restore $solution
    if ($LASTEXITCODE -ne 0) { throw "dotnet restore failed." }
    $status.restore = "PASS"

    dotnet build $solution -c $Configuration --no-restore
    if ($LASTEXITCODE -ne 0) { throw "dotnet build failed." }
    $status.build = "PASS"

    dotnet test (Join-Path $root "windows/tests/Sightline.Core.Tests/Sightline.Core.Tests.csproj") -c $Configuration --no-build --logger "trx;LogFileName=core.trx" --results-directory $evidence
    if ($LASTEXITCODE -ne 0) { throw "Core tests failed." }
    $status.coreTests = "PASS"

    dotnet test (Join-Path $root "windows/tests/Sightline.Windows.Tests/Sightline.Windows.Tests.csproj") -c $Configuration --no-build --logger "trx;LogFileName=windows-safety.trx" --results-directory $evidence
    if ($LASTEXITCODE -ne 0) { throw "Windows safety tests failed." }
    $status.windowsSafetyTests = "PASS"

    $app = Join-Path $root "windows/src/Sightline.App/bin/$Configuration/net8.0-windows/Sightline.App.dll"
    $resourceJson = & dotnet $app --resource
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($resourceJson)) { throw "Resource probe failed." }
    $resourceJson | Set-Content -Encoding utf8 (Join-Path $evidence "resource.json")
    $status.resourceProbe = "PASS"

    if ($Interactive) {
        $runner = Join-Path $root "windows/tests/Sightline.Windows.Acceptance/bin/$Configuration/net8.0-windows/Sightline.Windows.Acceptance.dll"
        $target = Join-Path $root "windows/tests/Sightline.Windows.TestTarget/bin/$Configuration/net8.0-windows/Sightline.Windows.TestTarget.exe"
        & dotnet $runner $target
        if ($LASTEXITCODE -ne 0) { throw "Interactive Windows acceptance failed." }
        $status.interactiveAcceptance = "PASS"
    }
}
catch {
    $status.failure = $_.Exception.Message
    throw
}
finally {
    $status.completedAt = [DateTimeOffset]::UtcNow
    $status | ConvertTo-Json -Depth 4 | Set-Content -Encoding utf8 (Join-Path $evidence "summary.json")
}
