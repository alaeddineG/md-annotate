import { useState, useRef, Fragment } from 'react';
import { Button, IconButton, Label, Textarea } from '@primer/react';
import { PencilIcon, XIcon } from '@primer/octicons-react';
import SelectionPopover from './SelectionPopover.jsx';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function ReviewThread({ annotation, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(annotation.comment);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editText.trim()) return;
    setSaving(true);
    try {
      await onUpdate(annotation.id, { comment: editText.trim() });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
    if (e.key === 'Escape') { setEditing(false); setEditText(annotation.comment); }
  }

  const lineLabel = annotation.startLine === annotation.endLine
    ? `L${annotation.startLine}`
    : `L${annotation.startLine}–${annotation.endLine}`;

  const quote = annotation.selectedText.length > 160
    ? annotation.selectedText.slice(0, 160) + '…'
    : annotation.selectedText;

  return (
    <div className={`review-thread${annotation.stale ? ' stale' : ''}`}>
      {/* Header */}
      <div className="thread-header">
        <div className="thread-avatar">AI</div>
        <span className="thread-author">Claude</span>
        <Label variant="accent" size="small">AI</Label>
        <span className="thread-time">{timeAgo(annotation.createdAt)}</span>
        <span className="thread-line-range">{lineLabel}</span>
        {annotation.stale && <Label variant="attention" size="small">outdated</Label>}
        <div className="thread-actions">
          {!editing && (
            <IconButton
              icon={PencilIcon}
              variant="invisible"
              size="small"
              aria-label="Edit comment"
              onClick={() => { setEditText(annotation.comment); setEditing(true); }}
            />
          )}
          <IconButton
            icon={XIcon}
            variant="danger"
            size="small"
            aria-label="Delete comment"
            onClick={() => onDelete(annotation.id)}
          />
        </div>
      </div>

      {/* Body */}
      <div className="thread-body">
        <div className="thread-quote">"{quote}"</div>
        {editing ? (
          <>
            <Textarea
              autoFocus
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={onKeyDown}
              rows={3}
              block
              resize="vertical"
            />
            <div className="thread-edit-footer">
              <span className="thread-edit-hint">⌘↵ save · Esc cancel</span>
              <div className="thread-edit-buttons">
                <Button
                  size="small"
                  variant="invisible"
                  onClick={() => { setEditing(false); setEditText(annotation.comment); }}
                >
                  Cancel
                </Button>
                <Button size="small" variant="primary" onClick={save} disabled={saving || !editText.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <p className="thread-comment">{annotation.comment}</p>
        )}
      </div>
    </div>
  );
}

export default function RawView({ filename, content, annotations, onAnnotate, onUpdate, onDelete }) {
  const containerRef = useRef(null);
  const lines = content.split('\n');

  const annsByEndLine = new Map();
  const sorted = [...annotations].sort((a, b) => a.startLine - b.startLine);
  for (const ann of sorted) {
    if (!annsByEndLine.has(ann.endLine)) annsByEndLine.set(ann.endLine, []);
    annsByEndLine.get(ann.endLine).push(ann);
  }

  const annotatedLines = new Set();
  annotations.forEach(ann => {
    for (let l = ann.startLine; l <= ann.endLine; l++) annotatedLines.add(l);
  });

  return (
    <div className="raw-wrap" ref={containerRef}>
      <SelectionPopover
        containerRef={containerRef}
        documentContent={content}
        onAnnotate={onAnnotate}
      />
      <div className="raw-file-card">
        <div className="raw-file-header">
          <span className="raw-file-name">{filename}</span>
          <span className="raw-file-stats">
            {lines.length} lines · {annotations.length} comment{annotations.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="raw-body">
          {lines.map((line, i) => {
            const lineNum = i + 1;
            const isAnnotated = annotatedLines.has(lineNum);
            const cards = annsByEndLine.get(lineNum) ?? [];

            return (
              <Fragment key={lineNum}>
                <div className={`raw-line${isAnnotated ? ' raw-line-annotated' : ''}`}>
                  <span className="raw-gutter">{lineNum}</span>
                  <span
                    className="raw-content"
                    data-line-start={lineNum}
                    data-line-end={lineNum}
                  >
                    {line}
                  </span>
                </div>
                {cards.map(ann => (
                  <ReviewThread
                    key={ann.id}
                    annotation={ann}
                    onUpdate={onUpdate}
                    onDelete={onDelete}
                  />
                ))}
              </Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
