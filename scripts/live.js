#!/usr/bin/env node
'use strict';

/**
 * One command for pool night: starts the PoolMasters server and an ngrok tunnel,
 * then prints every link people can use.
 *
 *   Double-click "Start PoolMasters.bat", or:
 *   npm run live                          (asks for a password the first time and saves it in .env)
 *   node scripts/live.js -p "secret" [--port 3000] [--no-tunnel]
 */

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const HELP = `
Usage: npm run live -- [options]

  -p, --password <pass>   Admin password (otherwise ADMIN_PASSWORD or the one saved in .env)
      --port <number>     Port to run on (default 3000)
      --no-tunnel         Only run on this network, skip ngrok
  -h, --help              Show this help
`;

// ------------------------------------------------------------------ saved settings

// The admin password lives in .env next to the app (git ignores it), so pool night is one double-click.
const ENV_FILE = path.join(__dirname, '..', '.env');
const fromEnvFile = new Set();

function loadEnvFile() {
  let text;
  try {
    text = fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
      fromEnvFile.add(m[1]);
    }
  }
}

function savePassword(password) {
  fs.writeFileSync(ENV_FILE, `# PoolMasters settings for this PC. Keep this file private.\nADMIN_PASSWORD=${password}\n`, { mode: 0o600 });
}

async function askPassword() {
  const readline = require('node:readline/promises');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  log();
  log(bold('  First time? Choose the admin password.'));
  log(dim('  You need it to sign in at /#/admin. It is saved on this PC, so you only do this once.'));
  log(dim('  Use the same one every time: the Gemini key is locked with it.'));
  log();
  for (;;) {
    const answer = (await rl.question('  Admin password: ')).trim();
    if (answer.length >= 6 && answer !== 'poolmasters') {
      rl.close();
      return answer;
    }
    log(yellow('  Use at least 6 characters, and not "poolmasters".'));
  }
}

// ------------------------------------------------------------------ args

function parseArgs(argv) {
  const opts = { password: process.env.ADMIN_PASSWORD, port: Number(process.env.PORT) || 3000, tunnel: true };
  for (let i = 0; i < argv.length; i++) {
    const [flag, inline] = argv[i].split(/=(.*)/s);
    const value = () => inline ?? argv[++i];
    switch (flag) {
      case '-p':
      case '--password':
        opts.password = value();
        opts.passwordFromArgs = true;
        if (!opts.password) {
          console.error('Missing password after -p.');
          process.exit(1);
        }
        break;
      case '--port':
        opts.port = Number(value());
        break;
      case '--no-tunnel':
        opts.tunnel = false;
        break;
      case '-h':
      case '--help':
        console.log(HELP);
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${argv[i]}\n${HELP}`);
        process.exit(1);
    }
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    console.error('Port must be a number between 1 and 65535.');
    process.exit(1);
  }
  return opts;
}

// ------------------------------------------------------------------ output

const tty = process.stdout.isTTY;
const paint = (code) => (s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = paint('1');
const dim = paint('2');
const green = paint('32');
const cyan = paint('36');
const yellow = paint('33');

const log = (msg = '') => console.log(msg);

function lanAddresses(port) {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => `http://${a.address}:${port}`);
}

function banner({ port, password, usingDefault, saved }, tunnelUrl, tunnelState) {
  const lan = lanAddresses(port);
  const row = (label, value) => `  ${dim(label.padEnd(16))}${value}`;
  log();
  log(bold('  🎱 PoolMasters is running'));
  log();
  log(row('This PC', cyan(`http://localhost:${port}`)));
  for (const url of lan) log(row('Same Wi-Fi', cyan(url)));
  if (tunnelState === 'up') log(row('Anywhere', `${green(bold(tunnelUrl))}  ${dim('← share this one')}`));
  else if (tunnelState === 'starting') log(row('Anywhere', dim('starting ngrok…')));
  else if (tunnelState === 'missing') log(row('Anywhere', yellow('ngrok not installed — winget install --id ngrok.ngrok')));
  else if (tunnelState === 'down') log(row('Anywhere', yellow('ngrok stopped — local links still work')));
  log();
  log(row('Admin password', usingDefault ? yellow(`${password} (default — use -p to change)`) : `${'•'.repeat(password.length)} ${dim(saved ? '(saved in .env; delete that file to choose a new one)' : '(set with -p)')}`));
  log(row('Admin', cyan(`http://localhost:${port}/#/admin`)));
  log(row('Stop', 'Ctrl+C'));
  log();
}

/** ngrok from PATH, or where winget and the Microsoft Store put it (winget's PATH change needs a new terminal). */
function findNgrok() {
  if (process.platform !== 'win32') return 'ngrok';
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'ngrok.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WindowsApps', 'ngrok.exe'),
  ];
  const onPath = (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, 'ngrok.exe'));
  return [...onPath, ...candidates].find((file) => fs.existsSync(file)) || 'ngrok';
}

/** What to do about the ngrok errors people actually run into. */
const NGROK_HINTS = {
  ERR_NGROK_4018: 'ngrok needs your authtoken once: ngrok config add-authtoken <token> (from dashboard.ngrok.com).',
  ERR_NGROK_105: 'The saved ngrok authtoken is wrong. Copy it again from dashboard.ngrok.com and run: ngrok config add-authtoken <token>',
  ERR_NGROK_108: 'ngrok is already running somewhere else with this account. Close the other one first.',
  ERR_NGROK_334: 'Your ngrok link is already in use, probably by another PoolMasters window. Close it first.',
};

// ------------------------------------------------------------------ main

loadEnvFile();
const opts = parseArgs(process.argv.slice(2));
let password;
let info;
const root = path.join(__dirname, '..');
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  log(dim('\n  Shutting down…'));
  // The server saves its data when it gets Ctrl+C. On Windows the console already delivers
  // Ctrl+C to every child (and kill() would terminate without saving), so only signal elsewhere.
  if (process.platform !== 'win32') {
    for (const child of children) if (child.exitCode === null) child.kill('SIGINT');
  }
  setTimeout(() => {
    for (const child of children) if (child.exitCode === null) child.kill();
    process.exit(code);
  }, 2500).unref();
  const allExited = () => children.every((c) => c.exitCode !== null || c.signalCode !== null);
  const poll = setInterval(() => {
    if (allExited()) {
      clearInterval(poll);
      process.exit(code);
    }
  }, 100);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

(async function main() {
  let saved = !opts.passwordFromArgs && fromEnvFile.has('ADMIN_PASSWORD');
  if (!opts.password && process.stdin.isTTY) {
    opts.password = await askPassword();
    savePassword(opts.password);
    saved = true;
    log(green('  Saved. Next time it starts straight away.'));
  }
  password = opts.password || 'poolmasters';
  info = { port: opts.port, password, usingDefault: !opts.password, saved };
  startServer();
})();

// 1) the server
function startServer() {
  const server = spawn(process.execPath, [path.join(root, 'server.js')], {
    cwd: root,
    env: { ...process.env, PORT: String(opts.port), ADMIN_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(server);

  let serverUp = false;
  server.stdout.on('data', (buf) => {
    const text = buf.toString();
    if (!serverUp && text.includes('running at')) {
      serverUp = true;
      onServerUp();
    } else if (serverUp) {
      process.stdout.write(dim(text));
    }
  });
  server.stderr.on('data', (buf) => {
    const text = buf.toString();
    if (text.includes('default admin password')) return; // the banner already says so
    if (text.includes('EADDRINUSE')) {
      console.error(yellow(`\n  Port ${opts.port} is already in use — is PoolMasters already running? Close that window first.`));
      return;
    }
    process.stderr.write(text);
  });
  server.on('exit', (code) => {
    if (!stopping) {
      console.error(yellow(`\n  The server stopped (exit code ${code}).`));
      stop(code || 1);
    }
  });
}

// 2) the tunnel. A free ngrok account always gets the same address (its dev domain).
function onServerUp() {
  if (!opts.tunnel) return banner(info, null, null);
  banner(info, null, 'starting');

  const tunnel = spawn(findNgrok(), ['http', String(opts.port), '--log', 'stdout', '--log-format', 'logfmt'], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(tunnel);

  let url = null;
  const hinted = new Set();
  const scan = (buf) => {
    const text = buf.toString();
    const found = text.match(/url=(https:\/\/[^\s"]+)/);
    if (found && !url) {
      url = found[1];
      banner(info, url, 'up');
      log(dim('  Visitors see an ngrok notice the first time: they tap "Visit Site" once (remembered for 7 days).'));
      log();
    }
    for (const [code, hint] of Object.entries(NGROK_HINTS)) {
      if (text.includes(code) && !hinted.has(code)) {
        hinted.add(code);
        log(yellow(`  ${hint}`));
      }
    }
    if (!url && !hinted.size && /lvl=(eror|crit)|ERROR:/.test(text)) process.stderr.write(dim(text));
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan);

  tunnel.on('error', (err) => {
    if (err.code === 'ENOENT') banner(info, null, 'missing');
    else console.error(yellow(`\n  Could not start ngrok: ${err.message}`));
  });
  tunnel.on('exit', (code) => {
    if (!stopping && code !== null) {
      console.error(yellow(`\n  ngrok exited (code ${code}). The local links still work.`));
      banner(info, null, 'down');
    }
  });
}
