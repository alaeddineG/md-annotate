import { useState } from 'react';
import { TextInput, CounterLabel } from '@primer/react';
import { SearchIcon } from '@primer/octicons-react';

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function DocumentList({ documents, activeId, onSelect }) {
  const [filter, setFilter] = useState('');

  const visible = filter
    ? documents.filter(d =>
        d.filename?.toLowerCase().includes(filter.toLowerCase()) ||
        d.context?.toLowerCase().includes(filter.toLowerCase())
      )
    : documents;

  return (
    <div className="doc-list">
      <div className="doc-list-search">
        <TextInput
          leadingVisual={SearchIcon}
          placeholder="Filter files..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          size="small"
          block
        />
      </div>
      <div className="doc-list-items">
        {visible.length === 0 && (
          <p className="doc-list-empty">{filter ? 'No matches.' : 'No documents.'}</p>
        )}
        {visible.map(doc => (
          <button
            key={doc.documentId}
            className={`doc-item${activeId === doc.documentId ? ' active' : ''}`}
            onClick={() => onSelect(doc.documentId)}
          >
            <span className="doc-item-name">{doc.filename}</span>
            <div>
              {doc.context && <span className="doc-item-context">{doc.context}</span>}
              <div className="doc-item-row">
                <span className="doc-item-date">{formatDate(doc.updatedAt)}</span>
                {doc.annotationCount > 0 && (
                  <CounterLabel scheme="primary">{doc.annotationCount}</CounterLabel>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
