import fs from 'fs';
import path from 'path';
import os from 'os';

const ROOT = path.join(os.homedir(), '.md-annotate');
const DOCS_DIR = path.join(ROOT, 'documents');

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sanitizeId(documentId) {
  return documentId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function docDir(documentId) {
  return path.join(DOCS_DIR, sanitizeId(documentId));
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Documents ──────────────────────────────────────────────────────────────

export function pushDocument({ documentId, filename, content, context }) {
  const dir = docDir(documentId);
  ensureDir(dir);

  const contentPath = path.join(dir, 'content.md');
  const metaPath = path.join(dir, 'meta.json');
  const annoPath = path.join(dir, 'annotations.json');

  const now = new Date().toISOString();
  const isRevision = fs.existsSync(contentPath);

  // Store previous revision in history/
  if (isRevision) {
    const histDir = path.join(dir, 'history');
    ensureDir(histDir);
    const ts = now.replace(/[:.]/g, '-');
    fs.copyFileSync(contentPath, path.join(histDir, `${ts}.md`));

    // Mark stale annotations whose rawSource no longer matches
    const annotations = readJson(annoPath, []);
    const newLines = content.split('\n');
    const updated = annotations.map(ann => {
      const slice = newLines.slice(ann.startLine - 1, ann.endLine).join('\n');
      return slice !== ann.rawSource ? { ...ann, stale: true } : ann;
    });
    writeJson(annoPath, updated);
  } else {
    writeJson(annoPath, []);
  }

  fs.writeFileSync(contentPath, content, 'utf-8');

  const existingMeta = isRevision ? readJson(metaPath, {}) : {};
  writeJson(metaPath, {
    documentId,
    filename,
    context: context ?? existingMeta.context ?? '',
    createdAt: existingMeta.createdAt ?? now,
    updatedAt: now,
  });

  return getDocument(documentId);
}

export function getDocument(documentId) {
  const dir = docDir(documentId);
  const metaPath = path.join(dir, 'meta.json');
  const contentPath = path.join(dir, 'content.md');
  const annoPath = path.join(dir, 'annotations.json');

  if (!fs.existsSync(metaPath)) return null;

  const meta = readJson(metaPath, {});
  const content = fs.existsSync(contentPath)
    ? fs.readFileSync(contentPath, 'utf-8')
    : '';
  const annotations = readJson(annoPath, []);

  return { ...meta, content, annotationCount: annotations.length };
}

export function listDocuments(filter) {
  ensureDir(DOCS_DIR);
  const entries = fs.readdirSync(DOCS_DIR, { withFileTypes: true });
  const docs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = readJson(path.join(DOCS_DIR, entry.name, 'meta.json'), null);
    if (!meta) continue;
    const annotations = readJson(
      path.join(DOCS_DIR, entry.name, 'annotations.json'),
      []
    );
    const doc = { ...meta, annotationCount: annotations.length };
    if (filter) {
      const f = filter.toLowerCase();
      if (
        !doc.filename?.toLowerCase().includes(f) &&
        !doc.context?.toLowerCase().includes(f) &&
        !doc.documentId?.toLowerCase().includes(f)
      ) {
        continue;
      }
    }
    docs.push(doc);
  }

  return docs.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
}

export function deleteDocument(documentId) {
  const dir = docDir(documentId);
  if (!fs.existsSync(dir)) return false;
  fs.rmSync(dir, { recursive: true, force: true });
  return true;
}

// ── Annotations ────────────────────────────────────────────────────────────

export function getAnnotations(documentId) {
  const dir = docDir(documentId);
  return readJson(path.join(dir, 'annotations.json'), []);
}

export function createAnnotation(documentId, { startLine, endLine, selectedText, rawSource, comment }) {
  const dir = docDir(documentId);
  ensureDir(dir);
  const annoPath = path.join(dir, 'annotations.json');
  const annotations = readJson(annoPath, []);

  const annotation = {
    id: crypto.randomUUID(),
    startLine,
    endLine,
    selectedText,
    rawSource,
    comment,
    stale: false,
    createdAt: new Date().toISOString(),
  };

  annotations.push(annotation);
  writeJson(annoPath, annotations);

  // Update annotationCount in meta
  const metaPath = path.join(dir, 'meta.json');
  const meta = readJson(metaPath, {});
  writeJson(metaPath, { ...meta, updatedAt: new Date().toISOString() });

  return annotation;
}

export function updateAnnotation(documentId, annotationId, { comment }) {
  const dir = docDir(documentId);
  const annoPath = path.join(dir, 'annotations.json');
  const annotations = readJson(annoPath, []);
  const idx = annotations.findIndex(a => a.id === annotationId);
  if (idx === -1) return null;
  annotations[idx] = { ...annotations[idx], comment };
  writeJson(annoPath, annotations);
  return annotations[idx];
}

export function deleteAnnotation(documentId, annotationId) {
  const dir = docDir(documentId);
  const annoPath = path.join(dir, 'annotations.json');
  const annotations = readJson(annoPath, []);
  const filtered = annotations.filter(a => a.id !== annotationId);
  if (filtered.length === annotations.length) return false;
  writeJson(annoPath, filtered);
  return true;
}

export function clearAnnotations(documentId) {
  const dir = docDir(documentId);
  const annoPath = path.join(dir, 'annotations.json');
  writeJson(annoPath, []);
}
