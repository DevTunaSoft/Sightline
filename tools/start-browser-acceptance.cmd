@echo off
setlocal
cd /d "%~dp0\.."

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: Node.js was not found.
  echo Install Node.js 20 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo Sightline Browser Acceptance
echo ============================
echo.
echo 1. Make sure the Sightline extension is loaded unpacked in Chrome or Edge.
echo 2. The acceptance page will open at http://127.0.0.1:8765/
echo 3. Open Sightline on that page.
echo 4. Click "Run browser self-test".
echo.
echo The self-test does not require Ollama or an AI model.
echo Press Ctrl+C in this window when finished.
echo.

start "" "http://127.0.0.1:8765/"
node tools\serve-acceptance.mjs
