import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.join(os.homedir(), '.md-annotate');

function getDaemonBase() {
  if (process.env.MD_ANNOTATE_DAEMON_URL) {
    return process.env.MD_ANNOTATE_DAEMON_URL.replace(/\/$/, '');
  }
  try {
    const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'daemon.json'), 'utf-8'));
    return `http://localhost:${info.port}`;
  } catch {
    throw new Error('md-annotate daemon is not running. Run: md-annotate start');
  }
}

async function api(method, urlPath, body) {
  const base = getDaemonBase();
  const res = await fetch(`${base}${urlPath}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

const TOOLS = [
  {
    name: 'md_push',
    description:
      'Push a markdown document for the human to review and annotate in the browser. ' +
      'If the documentId already exists, the content is replaced (revision) and existing annotations are preserved with a stale marker where the source changed.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: {
          type: 'string',
          description: 'Unique key for this document (e.g., conversation-id + filename). Stable across revisions.',
        },
        filename: {
          type: 'string',
          description: 'Display name shown in the sidebar (e.g., "rfc-messaging-infra.md").',
        },
        content: {
          type: 'string',
          description: 'Raw markdown string.',
        },
        context: {
          type: 'string',
          description: 'Optional free-text description (e.g., "RFC for MassTransit vs Wolverine evaluation").',
        },
      },
      required: ['documentId', 'filename', 'content'],
    },
  },
  {
    name: 'md_get_annotations',
    description:
      'Retrieve all annotations the human made on a specific document. ' +
      'Returns structured feedback with line numbers, raw source fragments, and comments. ' +
      'Stale annotations (where the underlying source changed after a revision) are flagged.',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'md_list_documents',
    description: 'List all documents currently stored in md-annotate.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          description: 'Optional substring filter on filename, context, or documentId.',
        },
      },
    },
  },
  {
    name: 'md_clear_annotations',
    description: 'Remove all annotations for a specific document (use before pushing a clean revision).',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string' },
      },
      required: ['documentId'],
    },
  },
];

async function handleToolCall(name, args) {
  switch (name) {
    case 'md_push': {
      const doc = await api('POST', '/api/documents', args);
      const info = JSON.parse(fs.readFileSync(path.join(ROOT, 'daemon.json'), 'utf-8'));
      const host = info.host && info.host !== '0.0.0.0' ? info.host : 'localhost';
      return {
        success: true,
        documentId: doc.documentId,
        filename: doc.filename,
        message: `Document "${doc.filename}" pushed. Open http://${host}:${info.port} to review.`,
      };
    }
    case 'md_get_annotations': {
      const data = await api('GET', `/api/documents/${encodeURIComponent(args.documentId)}/annotations`);
      return { documentId: data.documentId, annotations: data.annotations, count: data.annotations.length };
    }
    case 'md_list_documents': {
      const qs = args?.filter ? `?filter=${encodeURIComponent(args.filter)}` : '';
      return api('GET', `/api/documents${qs}`);
    }
    case 'md_clear_annotations': {
      await api('DELETE', `/api/documents/${encodeURIComponent(args.documentId)}/annotations`);
      return { success: true, documentId: args.documentId };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function makeMcpServer() {
  const server = new Server(
    { name: 'md-annotate', version: '2.0.0' },
    { capabilities: { tools: {} } }
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const result = await handleToolCall(name, args);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (err) {
      return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
    }
  });
  return server;
}

export async function startMcp() {
  const server = makeMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

/**
 * Mount MCP over HTTP (Streamable HTTP transport) on an existing Express app.
 * Clients connect at POST /mcp — stateless, no session management required.
 */
export function mountMcpHttp(app) {
  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    const server = makeMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on('finish', () => transport.close().catch(() => {}));
  });

  // GET /mcp: not used in stateless mode, reject cleanly
  app.get('/mcp', (_req, res) => {
    res.status(405).json({ error: 'MCP HTTP transport uses POST only (stateless mode)' });
  });
}

