# Setup and Recovery

## Clone and build
```
git clone https://github.com/DevTunaSoft/Sightline.git
cd Sightline
git checkout develop
npm run check
```

## Browser extension
1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode.
3. Load unpacked: select the `extension` folder.
4. Run `.\tools\run-browser-acceptance.ps1` (or Edge variant).
5. Open side panel, click "Run browser self-test".

## Local model
```
ollama pull hf.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF:Q4_K_M
node tools/ollama-acceptance.mjs --model "hf.co/ggml-org/SmolVLM2-2.2B-Instruct-GGUF:Q4_K_M"
```

## Windows
```
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\test-windows.ps1 -Interactive
```

## Recovery
- If `npm run check` fails, fix root cause and rerun.
- If git fetch is shallow, use explicit refspecs in CLAUDE.md section 3.1.
- Never force-push; verify remote SHA after push.
- Keep `.aider*` ignored.