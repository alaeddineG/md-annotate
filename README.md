# md-annotate

A shared markdown review surface between Claude (via MCP) and humans (via browser). Push markdown documents, annotate them inline like a GitHub PR review, and generate structured revision prompts — all in a local-first workflow.

## How it works

```
┌─────────────┐    MCP tools     ┌──────────────┐    Browser UI    ┌─────────────┐
│   Claude     │ ──────────────► │  md-annotate  │ ◄────────────── │    Human     │
│  (or any AI) │ ◄────────────── │    daemon     │ ──────────────► │  (reviewer)  │
└─────────────┘  push / read     └──────────────┘  annotate / view └─────────────┘
```

1. **Claude pushes** a markdown document via the `md_push` MCP tool
2. **Human reviews** in the browser — select text, add inline annotations (like PR review comments)
3. **Claude reads** annotations via `md_get_annotations` and revises the document
4. Repeat until done

## Quick start

```bash
# Clone and install
git clone https://github.com/alaeddineG/md-annotate.git
cd md-annotate
npm install

# Build the UI
npm run build

# Start the daemon
npm start
# → http://localhost:4242
```

Or use the setup script which handles everything including the MCP bridge:

```bash
chmod +x setup.sh
./setup.sh
```

## MCP integration

md-annotate exposes four tools to Claude via the [Model Context Protocol](https://modelcontextprotocol.io):

| Tool | Description |
|------|-------------|
| `md_push` | Push a markdown document for review |
| `md_get_annotations` | Read all human annotations on a document |
| `md_list_documents` | List all documents in the review queue |
| `md_clear_annotations` | Clear annotations after incorporating feedback |

### Claude Desktop (stdio transport)

Add to your Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "md-annotate": {
      "command": "npx",
      "args": ["md-annotate", "mcp"]
    }
  }
}
```

### Standalone MCP bridge

For environments where the MCP bridge needs to live outside the project directory (e.g. macOS sandbox restrictions with Claude Desktop):

```bash
# Build the self-contained bridge
npm run build:mcp

# Copy it somewhere accessible
mkdir -p ~/.mcp_servers/md-annotate
cp mcp-bridge.js ~/.mcp_servers/md-annotate/
```

Then configure Claude Desktop:

```json
{
  "mcpServers": {
    "md-annotate": {
      "command": "node",
      "args": [
        "/Users/you/.mcp_servers/md-annotate/mcp-bridge.js",
        "--daemon-url", "http://localhost:4242"
      ]
    }
  }
}
```

### Remote daemon

If the daemon runs on a different machine:

```json
{
  "mcpServers": {
    "md-annotate": {
      "command": "npx",
      "args": ["md-annotate", "mcp", "--daemon-url", "http://192.168.1.100:4242"]
    }
  }
}
```

## CLI

```
md-annotate start [--port 4242] [--host 0.0.0.0]   Start the daemon
md-annotate stop                                     Stop the daemon
md-annotate status                                   Show daemon status
md-annotate open                                     Open UI in browser
md-annotate push <file.md> [--id ID] [--context ""]  Push a file for review
md-annotate mcp [--daemon-url <url>]                 Run MCP stdio bridge
```

## Architecture

```
md-annotate/
├── bin/cli.js            # CLI entry point
├── server/
│   ├── daemon.js         # Express server (REST API + SSE + static files)
│   ├── mcp.js            # MCP server (stdio + HTTP transports)
│   └── store.js          # File-based document/annotation storage
├── src/                  # React frontend (Vite + @primer/react)
│   ├── App.jsx           # Main app with SSE real-time updates
│   └── components/
│       ├── RawView.jsx          # Raw markdown with inline review threads
│       ├── MarkdownPreview.jsx  # Rendered markdown preview
│       ├── SelectionPopover.jsx # Text selection → annotation popover
│       ├── DocumentList.jsx     # Sidebar document list
│       ├── ModeToggle.jsx       # Raw/Preview toggle
│       └── PromptGenerator.jsx  # Generate revision prompt from annotations
├── mcp-standalone.js     # Entry point for standalone MCP bridge
└── setup.sh              # Full setup script
```

**Storage:** Documents and annotations are persisted as JSON files under `~/.md-annotate/documents/`.

**Real-time:** The browser connects via Server-Sent Events (SSE) so annotations and document updates appear instantly — whether created from the UI or pushed via MCP.

## Development

```bash
# Start Vite dev server (hot reload) + proxy to daemon
npm run dev

# In another terminal, start the daemon
node server/daemon.js
```

## Requirements

- Node.js >= 18
- A browser
- Claude Desktop or any MCP-compatible client (for the AI side)

## License

MIT
