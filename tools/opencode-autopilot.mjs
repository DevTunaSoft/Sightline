/**
 * Sightline OpenCode autopilot: low-memory, single-worker process supervisor.
 * Runs one bounded noninteractive OpenCode cycle at a time; never interprets model output.
 * No raw transcripts are recorded. Ctrl+C or .artifacts/opencode-autopilot.stop stops safely.
 * Requires Node 22 (already used by Sightline's CI).
 */
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = path.join(repoRoot, '.artifacts');
const lockPath = path.join(artifacts, 'opencode-autopilot.lock');
const stopPath = path.join(artifacts, 'opencode-autopilot.stop');
const logPath = path.join(artifacts, 'opencode-autopilot.jsonl');
const MAX_LOG_BYTES = 128 * 1024;

export function parseOptions(args) {
  const opts = { model: '', maxCycles: 0, maxStalled: 2, maxFailures: 2,
    pauseSeconds: 5, timeoutMinutes: 50, auto: true };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--no-auto') { opts.auto = false; continue; }
    const key = { '--model': 'model', '--max-cycles': 'maxCycles',
      '--max-stalled': 'maxStalled', '--max-failures': 'maxFailures',
      '--pause-seconds': 'pauseSeconds', '--timeout-minutes': 'timeoutMinutes' }[arg];
    if (!key || i + 1 >= args.length) throw Error(`Unknown or incomplete argument: ${arg}`);
    const value = args[++i];
    if (key === 'model') {
      if (!/^[\w./:#-]{1,120}$/.test(value)) throw Error('Invalid model name');
      opts.model = value;
    } else {
      if (!/^\d+$/.test(value)) throw Error(`${arg} must be a nonnegative integer`);
      const n = Number(value);
      if (!Number.isSafeInteger(n) || n > 10080 || (key === 'timeoutMinutes' && n === 0) ||
          ((key === 'maxStalled' || key === 'maxFailures') && n === 0)) {
        throw Error(`${arg} is outside the supported range`);
      }
      opts[key] = n;
    }
  }
  return opts;
}

export function isLegacyOpenCodeVersion(output) {
  const match = String(output || '').trim().match(/^(?:opencode\s+)?v?(\d+)\.(\d+)\.(\d+)(?:\s|$)/i);
  return Boolean(match && Number(match[1]) < 2);
}

// A v1 CLI cannot read databases already migrated by OpenCode Desktop 2.x.
// Check the binary selected by the SAME shell used to launch run cycles.
function checkOpenCodeCliVersion() {
  const windows = process.platform === 'win32';
  const result = windows
    ? spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '& opencode --version; exit $LASTEXITCODE'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 15_000, windowsHide: true })
    : spawnSync('opencode', ['--version'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 15_000 });
  if (result.error || result.status !== 0) {
    throw Error('OpenCode CLI unavailable. Check "opencode --version" and PATH before launching autopilot.');
  }
  const version = (result.stdout || '').trim();
  if (isLegacyOpenCodeVersion(version)) {
    throw Error(`OpenCode CLI ${version} is incompatible with the OpenCode 2.x session database. On Windows, install the official v2 CLI: npm uninstall -g opencode-ai; npm install -g @opencode/cli. Do not delete opencode.db. Verify "opencode --version" reports 2.x before retrying.`);
  }
  if (!/^\s*(?:opencode\s+)?v?2\.\d+\.\d+/i.test(version)) {
    throw Error(`Unable to verify OpenCode CLI is v2: ${JSON.stringify(version.slice(0, 100))}. Confirm "opencode --version" manually.`);
  }
}

export function nextPrompt({ cycle, stalled }) {
  // Keep prompt short because the authoritative state belongs in the repo.
  return `Sightline autonomous engineering cycle ${cycle}. Read AGENTS.md, docs/OPENCODE_AUTONOMOUS_TAKEOVER.md and CLAUDE.md. Audit actual repo, branches, PRs, CI and current ledger first. Keep user safety and low-memory invariants. Choose and implement the highest priority unblocked project task; PR #8 selective reconciliation and routine hardening are preauthorized. The operator is not required for routine choices. Work on the repository, run relevant tests, fix failures, commit verified progress and update docs/HANDOFF.md with real evidence. Never ask which task to do next. If an external gate blocks a task, document it and do another independent one. This cycle has ${stalled} prior no-change cycle(s); ${stalled ? 'change strategy and select a different independent task.' : 'make measurable progress.'} Do not claim work after this process exits.`;
}

function gitState() {
  const options = { cwd: repoRoot, encoding: 'utf8', timeout: 10000, maxBuffer: 2 * 1024 * 1024 };
  return {
    head: execFileSync('git', ['rev-parse', 'HEAD'], options).trim(),
    status: execFileSync('git', ['status', '--porcelain'], options).trim(),
  };
}

export function madeProgress(before, after) {
  return before.head !== after.head || before.status !== after.status;
}

function pidIsAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (err) { return err.code !== 'ESRCH'; } // Treat access denied as alive (fail closed).
}

export function acquireLock(file, pid = process.pid) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Atomic create; stale recovery only after checking that the old PID is gone.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = fs.openSync(file, 'wx', 0o600);
      const token = `${pid}:${Date.now()}`;
      fs.writeFileSync(fd, JSON.stringify({ pid, token, startedUtc: new Date().toISOString() }));
      fs.closeSync(fd);
      return () => {
        try {
          const current = JSON.parse(fs.readFileSync(file, 'utf8'));
          if (current.token === token) fs.unlinkSync(file);
        } catch (err) { if (err.code !== 'ENOENT') throw err; }
      };
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      let old;
      try { old = JSON.parse(fs.readFileSync(file, 'utf8')); }
      catch { throw Error(`Ambiguous/corrupt lock. Inspect and remove manually: ${file}`); }
      if (!Number.isInteger(old.pid) || old.pid <= 0 || pidIsAlive(old.pid)) {
        throw Error(`Another autopilot process may be running (PID ${old.pid}). Refusing duplicate.`);
      }
      // Stale lock: if another process replaces it here, atomic wx creation fails safely.
      fs.unlinkSync(file);
    }
  }
  throw Error('Could not safely acquire runner lock');
}

function logEvent(event) {
  // Metadata only; never record model stdout/stderr, user inputs or account contents.
  const safe = JSON.stringify({ utc: new Date().toISOString(), ...event }) + '\n';
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size + Buffer.byteLength(safe) > MAX_LOG_BYTES) {
      fs.renameSync(logPath, `${logPath}.previous`); // Keep one prior bounded log.
    }
    fs.appendFileSync(logPath, safe, { encoding: 'utf8', mode: 0o600 });
  } catch (err) { console.error(`Autopilot metadata logging failed: ${err.code || 'unknown'}`); }
}

function terminateProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'],
      { stdio: 'ignore', windowsHide: true, timeout: 10000 });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); }
    catch { try { child.kill('SIGTERM'); } catch { /* already exited */ } }
  }
}

function executeOpenCode(prompt, options, active) {
  return new Promise((resolve) => {
    const args = ['run'];
    if (options.auto) args.push('--auto');
    if (options.model) args.push('--model', options.model);
    args.push(prompt);
    let child;
    if (process.platform === 'win32') {
      // PowerShell receives prompt/model through environment, NOT interpolated command text.
      // This supports .cmd shims and executable installations without CMD injection.
      const script = `$ErrorActionPreference='Stop'; $a=@('run'); if($env:SL_AUTOPILOT_AUTO -eq '1'){$a+='--auto'}; if($env:SL_AUTOPILOT_MODEL){$a+=@('--model',$env:SL_AUTOPILOT_MODEL)}; $a+=$env:SL_AUTOPILOT_PROMPT; & opencode @a; exit $LASTEXITCODE`;
      const env = { ...process.env, SL_AUTOPILOT_AUTO: options.auto ? '1' : '0',
        SL_AUTOPILOT_MODEL: options.model, SL_AUTOPILOT_PROMPT: prompt };
      child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script],
        { cwd: repoRoot, env, stdio: ['ignore', 'inherit', 'inherit'], windowsHide: false });
    } else {
      child = spawn('opencode', args, { cwd: repoRoot,
        stdio: ['ignore', 'inherit', 'inherit'], detached: true });
    }
    active.child = child;
    let settled = false;
    let timedOut = false;
    const finish = (code, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      active.child = null;
      resolve({ code, error: error?.code || null, timedOut });
    };
    const timer = setTimeout(() => { timedOut = true; terminateProcessTree(child); }, options.timeoutMinutes * 60_000);
    child.on('error', (err) => finish(127, err));
    child.on('exit', (code, signal) => finish(code ?? (signal ? 130 : 1), null));
  });
}

export async function runLoop(options, services = {}) {
  const getState = services.getState || gitState;
  const execute = services.execute || executeOpenCode;
  const log = services.log || logEvent;
  const pause = services.pause || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const shouldStop = services.shouldStop || (() => fs.existsSync(stopPath));
  const active = services.active || { child: null };
  let stalled = 0, failures = 0, cycle = 0;
  while (options.maxCycles === 0 || cycle < options.maxCycles) {
    if (shouldStop()) return { reason: 'STOP_REQUESTED', cycle, stalled, failures };
    cycle++;
    let before, after, result;
    try {
      before = getState();
      console.log(`Sightline cycle ${cycle}: running one OpenCode task (${before.head.slice(0, 7)})`);
      result = await execute(nextPrompt({ cycle, stalled }), options, active);
      after = getState();
    } catch (err) {
      result = { code: 1, error: err.code || err.message?.slice(0, 100) || 'unknown' };
      after = before;
    }
    const progress = Boolean(before && after && madeProgress(before, after));
    failures = result.code === 0 ? 0 : failures + 1;
    stalled = progress ? 0 : stalled + 1;
    log({ cycle, exitCode: result.code, error: result.error || null,
      timedOut: Boolean(result.timedOut), progress, head: after?.head?.slice(0, 12) || 'unknown',
      stalled, failures });
    if (shouldStop()) return { reason: 'STOP_REQUESTED', cycle, stalled, failures };
    if (failures >= options.maxFailures) return { reason: 'REPEATED_FAILURE', cycle, stalled, failures };
    if (stalled >= options.maxStalled) return { reason: 'NO_MEASURABLE_PROGRESS', cycle, stalled, failures };
    if (options.maxCycles && cycle >= options.maxCycles) break;
    await pause(options.pauseSeconds * 1000);
  }
  return { reason: 'MAX_CYCLES', cycle, stalled, failures };
}

async function main() {
  let release = null;
  const active = { child: null };
  let locallyInterrupted = false;
  const shutdown = () => { locallyInterrupted = true; try { fs.writeFileSync(stopPath, 'stop\n', { flag: 'w' }); } catch { /* ignore */ }
    terminateProcessTree(active.child); };
  try {
    const cliArgs = process.argv.slice(2);
    if (cliArgs.length === 1 && cliArgs[0] === '--stop') {
      fs.mkdirSync(artifacts, { recursive: true });
      fs.writeFileSync(stopPath, 'stop\n', { mode: 0o600 });
      console.log('Stop requested. Current cycle will finish or can be interrupted with Ctrl+C.');
      return;
    }
    if (cliArgs.length === 1 && cliArgs[0] === '--status') {
      const active = fs.existsSync(lockPath);
      const stopped = fs.existsSync(stopPath);
      console.log(`Autopilot: lock=${active ? 'present' : 'absent'}, stop=${stopped ? 'requested' : 'absent'}`);
      return;
    }
    const opts = parseOptions(cliArgs);
    if (!fs.existsSync(path.join(repoRoot, 'AGENTS.md'))) throw Error('Sightline AGENTS.md is missing');
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'],
      { cwd: repoRoot, encoding: 'utf8', timeout: 10000 }).trim();
    if (path.resolve(root).toLowerCase() !== repoRoot.toLowerCase()) throw Error('Not the Sightline git worktree');
    checkOpenCodeCliVersion();
    release = acquireLock(lockPath);
    if (fs.existsSync(stopPath)) {
      console.error(`Stop file exists at ${stopPath}. Remove it before starting a new run.`);
      process.exitCode = 3;
      return;
    }
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    const result = await runLoop(opts, { active });
    console.log(`Autopilot ended: ${result.reason}; cycles=${result.cycle}; stalled=${result.stalled}; failures=${result.failures}`);
    logEvent({ terminal: true, ...result });
    process.exitCode = result.reason === 'MAX_CYCLES' || result.reason === 'STOP_REQUESTED' ? 0 : 2;
  } catch (err) {
    console.error(`Autopilot BLOCKED: ${err.message}`);
    process.exitCode = 2;
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    if (release) release();
    if (locallyInterrupted) {
      try { fs.unlinkSync(stopPath); } catch (err) { if (err.code !== 'ENOENT') console.error('Could not clear stop file'); }
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
