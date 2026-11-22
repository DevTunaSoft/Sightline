$root = Split-Path -Parent $PSScriptRoot
$ext = Join-Path $root "extension"
$server = Start-Process -FilePath "node" -ArgumentList "tools/serve-acceptance.mjs" -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 2
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }
Start-Process -FilePath $edge -ArgumentList "--load-extension=$ext","http://127.0.0.1:8765/browser-agent.html"
Write-Host "Fixture server PID: $($server.Id)"
Write-Host "Open the Sightline side panel, then click Run browser self-test."
Write-Host "Press Enter to stop the fixture server."
Read-Host | Out-Null
Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue