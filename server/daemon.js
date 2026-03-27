import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import * as store from './store.js';
import { mountMcpHttp } from './mcp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(os.homedir(), '.md-annotate');

export async function startDaemon(port = 4242, host = '0.0.0.0') {
  const app = express();
  app.use(express.json());

  // ── Static (React SPA) ────────────────────────────────────────────────
  const distDir = path.join(__dirname, '..', 'dist');
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir));
  }

  // ── SSE ──────────────────────────────────────────────────────────────
  let sseClients = [];

  function broadcast(event, data) {
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    sseClients.forEach(res => res.write(payload));
  }

  app.get('/api/events', (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(':\n\n'); // keep-alive comment
    sseClients.push(res);
    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
  });

  // ── Documents ─────────────────────────────────────────────────────────
  app.get('/api/documents', (req, res) => {
    const docs = store.listDocuments(req.query.filter);
    res.json({ documents: docs });
  });

  app.get('/api/documents/:id', (req, res) => {
    const doc = store.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  });

  app.post('/api/documents', (req, res) => {
    const { documentId, filename, content, context } = req.body;
    if (!documentId || !filename || content == null) {
      return res.status(400).json({ error: 'documentId, filename, content required' });
    }
    const doc = store.pushDocument({ documentId, filename, content, context });
    broadcast('document_updated', { documentId, filename });
    res.status(201).json(doc);
  });

  app.delete('/api/documents/:id', (req, res) => {
    const ok = store.deleteDocument(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    broadcast('document_deleted', { documentId: req.params.id });
    res.json({ ok: true });
  });

  // ── Annotations ───────────────────────────────────────────────────────
  app.get('/api/documents/:id/annotations', (req, res) => {
    const annotations = store.getAnnotations(req.params.id);
    res.json({ documentId: req.params.id, annotations });
  });

  app.post('/api/documents/:id/annotations', (req, res) => {
    const { startLine, endLine, selectedText, rawSource, comment } = req.body;
    if (startLine == null || endLine == null || !comment) {
      return res.status(400).json({ error: 'startLine, endLine, comment required' });
    }
    const ann = store.createAnnotation(req.params.id, {
      startLine,
      endLine,
      selectedText: selectedText ?? '',
      rawSource: rawSource ?? '',
      comment,
    });
    broadcast('annotation_created', { documentId: req.params.id, annotation: ann });
    res.status(201).json(ann);
  });

  app.put('/api/documents/:id/annotations/:annId', (req, res) => {
    const ann = store.updateAnnotation(req.params.id, req.params.annId, req.body);
    if (!ann) return res.status(404).json({ error: 'Not found' });
    broadcast('annotation_updated', { documentId: req.params.id, annotation: ann });
    res.json(ann);
  });

  app.delete('/api/documents/:id/annotations/:annId', (req, res) => {
    const ok = store.deleteAnnotation(req.params.id, req.params.annId);
    if (!ok) return res.status(404).json({ error: 'Not found' });
    broadcast('annotation_deleted', { documentId: req.params.id, annotationId: req.params.annId });
    res.json({ ok: true });
  });

  app.delete('/api/documents/:id/annotations', (req, res) => {
    store.clearAnnotations(req.params.id);
    broadcast('annotations_cleared', { documentId: req.params.id });
    res.json({ ok: true });
  });

  // ── MCP over HTTP ─────────────────────────────────────────────────────
  mountMcpHttp(app);

  // ── SPA fallback ──────────────────────────────────────────────────────
  if (fs.existsSync(distDir)) {
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = app.listen(port, host, () => {
    const displayHost = host === '0.0.0.0' ? 'localhost' : host;
    console.log(`md-annotate daemon running on http://${displayHost}:${port}`);
    console.log(`MCP HTTP endpoint: http://${displayHost}:${port}/mcp`);
  });

  // Write daemon info so CLI and MCP can find it
  fs.mkdirSync(ROOT, { recursive: true });
  fs.writeFileSync(
    path.join(ROOT, 'daemon.json'),
    JSON.stringify({ pid: process.pid, port, host }, null, 2)
  );

  // Graceful shutdown
  function shutdown() {
    server.close();
    try { fs.unlinkSync(path.join(ROOT, 'daemon.json')); } catch {}
    process.exit(0);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { app, server, broadcast };
}

// Direct invocation: node server/daemon.js
const port = parseInt(process.env.MD_ANNOTATE_PORT ?? '4242', 10);
const host = process.env.MD_ANNOTATE_HOST ?? '0.0.0.0';
startDaemon(port, host);

