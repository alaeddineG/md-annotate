import { useState, useEffect, useCallback } from 'react';
import DocumentList from './components/DocumentList.jsx';
import MarkdownPreview from './components/MarkdownPreview.jsx';
import RawView from './components/RawView.jsx';
import ModeToggle from './components/ModeToggle.jsx';
import PromptGenerator from './components/PromptGenerator.jsx';
import { Button } from '@primer/react';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [doc, setDoc] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [mode, setMode] = useState('raw');

  const fetchDocuments = useCallback(async () => {
    const res = await fetch('/api/documents');
    const data = await res.json();
    setDocuments(data.documents ?? []);
  }, []);

  const fetchDoc = useCallback(async (id) => {
    const [docRes, annRes] = await Promise.all([
      fetch(`/api/documents/${encodeURIComponent(id)}`),
      fetch(`/api/documents/${encodeURIComponent(id)}/annotations`),
    ]);
    setDoc(await docRes.json());
    const annData = await annRes.json();
    setAnnotations(annData.annotations ?? []);
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);
  useEffect(() => { if (activeId) fetchDoc(activeId); }, [activeId, fetchDoc]);

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
      if (documentId === activeId) { setActiveId(null); setDoc(null); setAnnotations([]); }
    });
    es.addEventListener('annotation_created', (e) => {
      const { documentId, annotation } = JSON.parse(e.data);
      if (documentId === activeId) setAnnotations(prev => [...prev, annotation]);
    });
    es.addEventListener('annotation_updated', (e) => {
      const { documentId, annotation } = JSON.parse(e.data);
      if (documentId === activeId)
        setAnnotations(prev => prev.map(a => a.id === annotation.id ? annotation : a));
    });
    es.addEventListener('annotation_deleted', (e) => {
      const { documentId, annotationId } = JSON.parse(e.data);
      if (documentId === activeId)
        setAnnotations(prev => prev.filter(a => a.id !== annotationId));
    });
    es.addEventListener('annotations_cleared', (e) => {
      const { documentId } = JSON.parse(e.data);
      if (documentId === activeId) setAnnotations([]);
    });
    return () => es.close();
  }, [activeId, fetchDocuments, fetchDoc]);

  async function createAnnotation(data) {
    await fetch(`/api/documents/${encodeURIComponent(activeId)}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    fetchDocuments();
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
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="logo">md-annotate</span>
        </div>
        <DocumentList
          documents={documents}
          activeId={activeId}
          onSelect={id => setActiveId(id)}
        />
      </aside>

      {/* Main */}
      <main className="main">
        {doc ? (
          <>
            <div className="topbar">
              <span className="topbar-filename">{doc.filename}</span>
              {doc.context && <span className="topbar-context">{doc.context}</span>}
              <div className="topbar-actions">
                <ModeToggle mode={mode} onChange={setMode} />
                {annotations.length > 0 && (
                  <Button size="small" onClick={() => setShowPrompt(true)}>
                    Generate Prompt
                  </Button>
                )}
              </div>
            </div>

            <div className="content-area">
              {mode === 'raw' ? (
                <RawView
                  filename={doc.filename}
                  content={doc.content}
                  annotations={annotations}
                  onAnnotate={createAnnotation}
                  onUpdate={updateAnnotation}
                  onDelete={deleteAnnotation}
                />
              ) : (
                <MarkdownPreview content={doc.content} />
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            {documents.length === 0
              ? 'No documents yet. Push one with md-annotate push <file.md>'
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
