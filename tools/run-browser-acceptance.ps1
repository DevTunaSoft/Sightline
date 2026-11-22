# Starts the fixture server and opens Chrome with the unpacked extension and fixture page.
# Then open the Sightline side panel and click "Run browser self-test".
$root = Split-Path -Parent $PSScriptRoot
$ext = Join-Path $root "extension"
$server = Start-Process -FilePath "node" -ArgumentList "tools/serve-acceptance.mjs" -WorkingDirectory $root -PassThru
Start-Sleep -Seconds 2
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chrome)) { $chrome = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" }
Start-Process -FilePath $chrome -ArgumentList "--load-extension=$ext","http://127.0.0.1:8765/browser-agent.html"
Write-Host "Fixture server PID: $($server.Id)"
Write-Host "Open the Sightline side panel, then click Run browser self-test."
Write-Host "Press Enter to stop the fixture server."
Read-Host | Out-Null
Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue