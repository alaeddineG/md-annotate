import { useState } from 'react';

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function CommentItem({ ann, onScrollTo, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(ann.comment);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft.trim()) return;
    setSaving(true);
    await onUpdate(ann.id, { comment: draft.trim() });
    setSaving(false);
    setEditing(false);
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') save();
    if (e.key === 'Escape') { setEditing(false); setDraft(ann.comment); }
  }

  return (
    <div className={`comment-item ${ann.stale ? 'stale' : ''}`}>
      <div className="comment-header">
        <button
          className="comment-lines"
          title="Scroll to source"
          onClick={() => onScrollTo(ann.startLine)}
        >
          L{ann.startLine}{ann.startLine !== ann.endLine ? `–${ann.endLine}` : ''}
        </button>
        {ann.stale && <span className="stale-badge" title="Source changed after annotation">stale</span>}
        <div className="comment-actions">
          <button className="btn-icon" title="Edit" onClick={() => { setEditing(true); setDraft(ann.comment); }}>✎</button>
          <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => onDelete(ann.id)}>✕</button>
        </div>
      </div>

      {ann.selectedText && (
        <div className="comment-quote">"{ann.selectedText.slice(0, 120)}{ann.selectedText.length > 120 ? '…' : ''}"</div>
      )}

      {editing ? (
        <div className="comment-edit">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
          />
          <div className="comment-edit-footer">
            <button className="btn btn-sm" onClick={() => { setEditing(false); setDraft(ann.comment); }}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <p className="comment-text">{ann.comment}</p>
      )}

      <div className="comment-footer">{formatTime(ann.createdAt)}</div>
    </div>
  );
}

export default function CommentList({ annotations, onScrollTo, onUpdate, onDelete }) {
  const sorted = [...annotations].sort((a, b) => a.startLine - b.startLine);

  return (
    <div className="comment-list">
      <div className="comment-list-header">
        Comments {annotations.length > 0 && <span className="badge">{annotations.length}</span>}
      </div>
      {sorted.length === 0 ? (
        <div className="comment-list-empty">
          Select text in the preview and click Comment.
        </div>
      ) : (
        sorted.map(ann => (
          <CommentItem
            key={ann.id}
            ann={ann}
            onScrollTo={onScrollTo}
            onUpdate={onUpdate}
            onDelete={onDelete}
          />
        ))
      )}
    </div>
  );
}
