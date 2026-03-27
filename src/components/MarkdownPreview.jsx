import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import SelectionPopover from './SelectionPopover.jsx';

// Attach data-line-start / data-line-end to every block element
// node.position comes from remark's parse result
function lineProps(node) {
  if (!node?.position) return {};
  return {
    'data-line-start': node.position.start.line,
    'data-line-end': node.position.end.line,
  };
}

function makeComponents(annotations) {
  // Build a set of annotated line ranges for highlighting
  const annotatedLines = new Set();
  annotations.forEach(ann => {
    for (let l = ann.startLine; l <= ann.endLine; l++) annotatedLines.add(l);
  });

  function highlighted(node) {
    if (!node?.position) return false;
    for (let l = node.position.start.line; l <= node.position.end.line; l++) {
      if (annotatedLines.has(l)) return true;
    }
    return false;
  }

  const wrap = (Tag) => ({ node, children, ...props }) => (
    <Tag
      {...props}
      {...lineProps(node)}
      className={[props.className, highlighted(node) ? 'annotated' : ''].filter(Boolean).join(' ')}
    >
      {children}
    </Tag>
  );

  return {
    p: wrap('p'),
    h1: wrap('h1'),
    h2: wrap('h2'),
    h3: wrap('h3'),
    h4: wrap('h4'),
    h5: wrap('h5'),
    h6: wrap('h6'),
    li: wrap('li'),
    blockquote: wrap('blockquote'),
    pre: wrap('pre'),
    table: wrap('table'),
    tr: wrap('tr'),
    th: wrap('th'),
    td: wrap('td'),
  };
}

export default function MarkdownPreview({
  content,
  annotations,
  highlightLine,
  onAnnotate,
  documentContent,
}) {
  const containerRef = useRef(null);

  // Scroll to highlighted line when CommentList item clicked
  useEffect(() => {
    if (highlightLine == null || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-line-start="${highlightLine}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    }
  }, [highlightLine]);

  return (
    <div className="preview-wrap" ref={containerRef}>
      <SelectionPopover
        containerRef={containerRef}
        documentContent={documentContent}
        onAnnotate={onAnnotate}
      />
      <div className="markdown-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight]}
          components={makeComponents(annotations)}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
