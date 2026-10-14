#!/usr/bin/env node
'use strict';

/**
 * One command for pool night: starts the PoolMasters server and a Cloudflare Quick Tunnel,
 * then prints every link people can use.
 *
 *   npm run live -- -p "secret"
 *   node scripts/live.js -p "secret" [--port 3000] [--no-tunnel]
 */

const { spawn } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const HELP = `
Usage: npm run live -- [options]

  -p, --password <pass>   Admin password (otherwise ADMIN_PASSWORD, else "poolmasters")
      --port <number>     Port to run on (default 3000)
      --no-tunnel         Only run on this network, skip Cloudflare
  -h, --help              Show this help
`;

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

function banner({ port, password, usingDefault }, tunnelUrl, tunnelState) {
  const lan = lanAddresses(port);
  const row = (label, value) => `  ${dim(label.padEnd(16))}${value}`;
  log();
  log(bold('  🎱 PoolMasters is running'));
  log();
  log(row('This PC', cyan(`http://localhost:${port}`)));
  for (const url of lan) log(row('Same Wi-Fi', cyan(url)));
  if (tunnelState === 'up') log(row('Anywhere', `${green(bold(tunnelUrl))}  ${dim('← share this one')}`));
  else if (tunnelState === 'starting') log(row('Anywhere', dim('starting Cloudflare tunnel…')));
  else if (tunnelState === 'missing') log(row('Anywhere', yellow('cloudflared not installed — winget install --id Cloudflare.cloudflared')));
  else if (tunnelState === 'down') log(row('Anywhere', yellow('Cloudflare tunnel stopped — local links still work')));
  log();
  log(row('Admin password', usingDefault ? yellow(`${password} (default — use -p to change)`) : `${'•'.repeat(password.length)} ${dim('(set with -p)')}`));
  log(row('Stop', 'Ctrl+C'));
  log();
}

/** cloudflared from PATH, or the usual Windows install folders (winget's PATH change needs a new terminal). */
function findCloudflared() {
  if (process.platform !== 'win32') return 'cloudflared';
  const fs = require('node:fs');
  const candidates = [
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'cloudflared', 'cloudflared.exe'),
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'cloudflared', 'cloudflared.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Links', 'cloudflared.exe'),
  ];
  const onPath = (process.env.PATH || '').split(path.delimiter).map((dir) => path.join(dir, 'cloudflared.exe'));
  return [...onPath, ...candidates].find((file) => fs.existsSync(file)) || 'cloudflared';
}

// ------------------------------------------------------------------ main

const opts = parseArgs(process.argv.slice(2));
const usingDefault = !opts.password;
const password = opts.password || 'poolmasters';
const info = { port: opts.port, password, usingDefault };
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

// 1) the server
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
    console.error(yellow(`\n  Port ${opts.port} is already in use — is PoolMasters already running? Try --port 3001.`));
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

// 2) the tunnel
function onServerUp() {
  if (!opts.tunnel) return banner(info, null, null);
  banner(info, null, 'starting');

  const tunnel = spawn(findCloudflared(), ['tunnel', '--no-autoupdate', '--url', `http://localhost:${opts.port}`], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(tunnel);

  let url = null;
  const scan = (buf) => {
    const text = buf.toString();
    const found = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (found && !url) {
      url = found[0];
      banner(info, url, 'up');
      log(dim('  Tip: phones on the Cloudflare link refresh every 2 s (live updates need the Wi-Fi link).'));
      log();
    } else if (/\bERR\b/.test(text) && !url) {
      process.stderr.write(dim(text));
    }
  };
  tunnel.stdout.on('data', scan);
  tunnel.stderr.on('data', scan); // cloudflared logs to stderr

  tunnel.on('error', (err) => {
    if (err.code === 'ENOENT') banner(info, null, 'missing');
    else console.error(yellow(`\n  Could not start cloudflared: ${err.message}`));
  });
  tunnel.on('exit', (code) => {
    if (!stopping && code !== null) {
      console.error(yellow(`\n  Cloudflare tunnel exited (code ${code}). The local links still work.`));
      banner(info, null, 'down');
    }
  });
}
