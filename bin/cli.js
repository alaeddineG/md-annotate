#!/usr/bin/env node
import { spawn } from 'child_process';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(os.homedir(), '.md-annotate');
const DAEMON_INFO = path.join(ROOT, 'daemon.json');
const DAEMON_LOG = path.join(ROOT, 'daemon.log');

function readDaemonInfo() {
  try {
    return JSON.parse(fs.readFileSync(DAEMON_INFO, 'utf-8'));
  } catch {
    return null;
  }
}

function isDaemonRunning(info) {
  if (!info) return false;
  try {
    process.kill(info.pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const args = { flags: {}, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args.flags[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    } else {
      args.positional.push(argv[i]);
    }
  }
  return args;
}

const [,, command, ...rest] = process.argv;
const { flags, positional } = parseArgs(rest);

const daemonScript = path.join(__dirname, '..', 'server', 'daemon.js');
const mcpScript = path.join(__dirname, '..', 'server', 'mcp.js');

switch (command) {
  case 'start': {
    const info = readDaemonInfo();
    if (isDaemonRunning(info)) {
      const displayHost = info.host && info.host !== '0.0.0.0' ? info.host : 'localhost';
      console.log(`md-annotate already running on http://${displayHost}:${info.port} (pid ${info.pid})`);
      process.exit(0);
    }

    const port = parseInt(flags.port ?? '4242', 10);
    const host = flags.host ?? '0.0.0.0';
    fs.mkdirSync(ROOT, { recursive: true });
    const logFd = fs.openSync(DAEMON_LOG, 'a');

    const child = spawn(
      process.execPath,
      [daemonScript],
      {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, MD_ANNOTATE_PORT: String(port), MD_ANNOTATE_HOST: host },
      }
    );
    child.unref();

    // Wait briefly for daemon to write its info file
    let waited = 0;
    const poll = setInterval(() => {
      waited += 100;
      const d = readDaemonInfo();
      if (isDaemonRunning(d)) {
        clearInterval(poll);
        const displayHost = d.host && d.host !== '0.0.0.0' ? d.host : 'localhost';
        console.log(`md-annotate started on http://${displayHost}:${d.port} (pid ${d.pid})`);
        console.log(`MCP HTTP: http://${displayHost}:${d.port}/mcp`);
        console.log(`Logs: ${DAEMON_LOG}`);
        process.exit(0);
      }
      if (waited >= 3000) {
        clearInterval(poll);
        console.error('Daemon did not start in time. Check logs:', DAEMON_LOG);
        process.exit(1);
      }
    }, 100);
    break;
  }

  case 'stop': {
    const info = readDaemonInfo();
    if (!isDaemonRunning(info)) {
      console.log('md-annotate is not running.');
      process.exit(0);
    }
    process.kill(info.pid, 'SIGTERM');
    console.log(`Stopped md-annotate (pid ${info.pid})`);
    break;
  }

  case 'status': {
    const info = readDaemonInfo();
    if (isDaemonRunning(info)) {
      const displayHost = info.host && info.host !== '0.0.0.0' ? info.host : 'localhost';
      console.log(`running  http://${displayHost}:${info.port}  pid ${info.pid}`);
      console.log(`MCP HTTP: http://${displayHost}:${info.port}/mcp`);
    } else {
      console.log('stopped');
    }
    break;
  }

  case 'open': {
    const info = readDaemonInfo();
    if (!isDaemonRunning(info)) {
      console.error('md-annotate is not running. Start it with: md-annotate start');
      process.exit(1);
    }
    const { default: open } = await import('open');
    await open(`http://localhost:${info.port}`);
    break;
  }

  case 'push': {
    const file = positional[0];
    if (!file) {
      console.error('Usage: md-annotate push <file.md> [--id <documentId>] [--context "description"]');
      process.exit(1);
    }

    let info = readDaemonInfo();
    if (!isDaemonRunning(info)) {
      // Auto-start daemon
      const port = parseInt(flags.port ?? '4242', 10);
      fs.mkdirSync(ROOT, { recursive: true });
      const logFd = fs.openSync(DAEMON_LOG, 'a');
      const child = spawn(process.execPath, [daemonScript], {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, MD_ANNOTATE_PORT: String(port) },
      });
      child.unref();
      await new Promise(resolve => setTimeout(resolve, 800));
      info = readDaemonInfo();
    }

    const content = fs.readFileSync(path.resolve(file), 'utf-8');
    const filename = path.basename(file);
    const documentId = flags.id ?? filename;
    const context = flags.context ?? '';

    const res = await fetch(`http://localhost:${info.port}/api/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId, filename, content, context }),
    });

    if (!res.ok) {
      console.error('Push failed:', await res.text());
      process.exit(1);
    }

    const displayHost = info.host && info.host !== '0.0.0.0' ? info.host : 'localhost';
    console.log(`Pushed "${filename}" → http://${displayHost}:${info.port}`);
    break;
  }

  case 'mcp': {
    if (flags['daemon-url']) {
      // Remote mode: point at a daemon on another machine, skip local auto-start
      process.env.MD_ANNOTATE_DAEMON_URL = flags['daemon-url'];
    } else {
      // Local mode: auto-start daemon if needed
      const info = readDaemonInfo();
      if (!isDaemonRunning(info)) {
        const port = 4242;
        fs.mkdirSync(ROOT, { recursive: true });
        const logFd = fs.openSync(DAEMON_LOG, 'a');
        const child = spawn(process.execPath, [daemonScript], {
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: { ...process.env, MD_ANNOTATE_PORT: String(port) },
        });
        child.unref();
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    const { startMcp } = await import('../server/mcp.js');
    await startMcp();
    break;
  }

  default: {
    console.log(`md-annotate v2

Commands:
  start [--port 4242] [--host 0.0.0.0]  Start the daemon
  stop                                   Stop the daemon
  status                                 Show daemon status
  open                                   Open the UI in browser
  push <file.md> [--id ID] [--context]   Push a file for review
  mcp [--daemon-url <url>]               Run MCP stdio bridge (for Claude)

MCP stdio config (same machine):
  { "mcpServers": { "md-annotate": { "command": "npx", "args": ["md-annotate", "mcp"] } } }

MCP stdio config (remote daemon):
  { "mcpServers": { "md-annotate": { "command": "npx", "args": ["md-annotate", "mcp", "--daemon-url", "http://<host>:<port>"] } } }
`);
    break;
  }
}
