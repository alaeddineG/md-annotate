import { useState, useEffect, useCallback } from 'react';
import DocumentList from './components/DocumentList.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';
import CommentList from './components/CommentList.jsx';
import PromptGenerator from './components/PromptGenerator.jsx';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [doc, setDoc] = useState(null); // { documentId, filename, content, context, ... }
  const [annotations, setAnnotations] = useState([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [highlightLine, setHighlightLine] = useState(null);

  // ── Fetch document list ───────────────────────────────────────────────
  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.documents ?? []);
  }, []);

  // ── Fetch active document ─────────────────────────────────────────────
  const fetchDoc = useCallback(async (id) => {
    const [docRes, annRes] = await Promise.all([
      fetch(`/api/documents/${encodeURIComponent(id)}`),
      fetch(`/api/documents/${encodeURIComponent(id)}/annotations`),
    ]);
    setDoc(await docRes.json());
    const annData = await annRes.json();
    setAnnotations(annData.annotations ?? []);
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  useEffect(() => {
    if (activeId) fetchDoc(activeId);
  }, [activeId, fetchDoc]);

  // ── SSE ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const es = new EventSource('/api/events');

    es.addEventListener('document_updated', (e) => {
      const { documentId } = JSON.parse(e.data);
      fetchDocuments();
      if (documentId === activeId) fetchDoc(documentId);
    });

    es.addEventListener('document_deleted', (e) => {
      const { documentId } = JSON.parse(e.data);
      fetchDocuments();
      if (documentId === activeId) {
        setActiveId(null);
        setDoc(null);
        setAnnotations([]);
      }
    });

    es.addEventListener('annotation_created', (e) => {
      const { documentId, annotation } = JSON.parse(e.data);
      if (documentId === activeId) {
        setAnnotations(prev => [...prev, annotation]);
      }
    });

    es.addEventListener('annotation_updated', (e) => {
      const { documentId, annotation } = JSON.parse(e.data);
      if (documentId === activeId) {
        setAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a));
      }
    });

    es.addEventListener('annotation_deleted', (e) => {
      const { documentId, annotationId } = JSON.parse(e.data);
      if (documentId === activeId) {
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
      }
    });

    es.addEventListener('annotations_cleared', (e) => {
      const { documentId } = JSON.parse(e.data);
      if (documentId === activeId) setAnnotations([]);
    });

    return () => es.close();
  }, [activeId, fetchDocuments, fetchDoc]);

  // ── Annotation CRUD ───────────────────────────────────────────────────
  async function createAnnotation(data) {
    await fetch(`/api/documents/${encodeURIComponent(activeId)}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    // State update handled by the annotation_created SSE event.
    fetchDocuments(); // refresh annotation counts
  }

  async function updateAnnotation(annId, data) {
    const res = await fetch(
      `/api/documents/${encodeURIComponent(activeId)}/annotations/${annId}`,
      { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
    );
    const ann = await res.json();
    setAnnotations(prev => prev.map(a => a.id === annId ? ann : a));
  }

  async function deleteAnnotation(annId) {
    await fetch(
      `/api/documents/${encodeURIComponent(activeId)}/annotations/${annId}`,
      { method: 'DELETE' }
    );
    setAnnotations(prev => prev.filter(a => a.id !== annId));
    fetchDocuments();
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo">md-annotate</span>
        </div>
        <DocumentList
          documents={documents}
          activeId={activeId}
          onSelect={id => { setActiveId(id); setHighlightLine(null); }}
        />
      </aside>

      <main className="main">
        {doc ? (
          <>
            <div className="topbar">
              <span className="topbar-filename">{doc.filename}</span>
              {doc.context && <span className="topbar-context">{doc.context}</span>}
              <div className="topbar-actions">
                <span className="badge">{annotations.length} annotation{annotations.length !== 1 ? 's' : ''}</span>
                {annotations.length > 0 && (
                  <button className="btn btn-sm" onClick={() => setShowPrompt(true)}>
                    Generate Prompt
                  </button>
                )}
              </div>
            </div>

            <div className="content-area">
              <MarkdownPreview
                content={doc.content}
                annotations={annotations}
                highlightLine={highlightLine}
                onAnnotate={createAnnotation}
                documentContent={doc.content}
              />
              <CommentList
                annotations={annotations}
                onScrollTo={line => setHighlightLine(line)}
                onUpdate={updateAnnotation}
                onDelete={deleteAnnotation}
              />
            </div>
          </>
        ) : (
          <div className="empty-state">
            {documents.length === 0
              ? 'No documents yet. Push one with md_push or md-annotate push <file.md>'
              : 'Select a document from the sidebar.'}
          </div>
        )}
      </main>

      {showPrompt && doc && (
        <PromptGenerator
          doc={doc}
          annotations={annotations}
          onClose={() => setShowPrompt(false)}
        />
      )}
    </div>
  );
}
