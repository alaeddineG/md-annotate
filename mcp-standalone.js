#!/usr/bin/env node
// Standalone MCP bridge for Claude Desktop.
// Usage: node mcp-bridge.js [--daemon-url http://localhost:4242]
//
// Place this file anywhere outside ~/Documents and point Claude Desktop at it:
// { "command": "node", "args": ["/path/to/mcp-bridge.js", "--daemon-url", "http://localhost:4242"] }

const args = process.argv.slice(2);
const daemonUrlIdx = args.indexOf('--daemon-url');
if (daemonUrlIdx !== -1 && args[daemonUrlIdx + 1]) {
  process.env.MD_ANNOTATE_DAEMON_URL = args[daemonUrlIdx + 1];
}

import('./server/mcp.js').then(({ startMcp }) => startMcp()).catch(err => {
  process.stderr.write(`md-annotate mcp bridge error: ${err.message}\n`);
  process.exit(1);
});
