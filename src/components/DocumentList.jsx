import { useState } from 'react';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DocumentList({ documents, activeId, onSelect }) {
  const [filter, setFilter] = useState('');

  const visible = filter
    ? documents.filter(
        d =>
          d.filename?.toLowerCase().includes(filter.toLowerCase()) ||
          d.context?.toLowerCase().includes(filter.toLowerCase())
      )
    : documents;

  return (
    <div className="doc-list">
      <div className="doc-list-search">
        <input
          type="search"
          placeholder="Filter..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
        />
      </div>
      <div className="doc-list-items">
        {visible.length === 0 && (
          <div className="doc-list-empty">
            {filter ? 'No matches.' : 'No documents.'}
          </div>
        )}
        {visible.map(doc => (
          <button
            key={doc.documentId}
            className={`doc-item ${activeId === doc.documentId ? 'active' : ''}`}
            onClick={() => onSelect(doc.documentId)}
          >
            <span className="doc-item-name">{doc.filename}</span>
            <div className="doc-item-meta">
              {doc.context && <span className="doc-item-context">{doc.context}</span>}
              <div className="doc-item-row">
                <span className="doc-item-date">{formatDate(doc.updatedAt)}</span>
                {doc.annotationCount > 0 && (
                  <span className="doc-item-badge">{doc.annotationCount}</span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
