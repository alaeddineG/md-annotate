import { useState } from 'react';
import { Button } from '@primer/react';

function buildPrompt(doc, annotations) {
  const sorted = [...annotations].sort((a, b) => a.startLine - b.startLine);
  const lines = [
    `Please revise the following document based on the annotations below.`,
    ``,
    `**Document:** ${doc.filename}`,
    doc.context ? `**Context:** ${doc.context}` : null,
    ``,
    `---`,
    ``,
    `## Annotations`,
    ``,
  ].filter(l => l !== null);

  sorted.forEach((ann, i) => {
    lines.push(`### ${i + 1}. Lines ${ann.startLine}–${ann.endLine}`);
    lines.push(``);
    if (ann.rawSource) {
      lines.push(`**Source:**`);
      lines.push('```markdown');
      lines.push(ann.rawSource);
      lines.push('```');
      lines.push(``);
    }
    if (ann.selectedText && ann.selectedText !== ann.rawSource) {
      lines.push(`**Selected text:** "${ann.selectedText}"`);
      lines.push(``);
    }
    lines.push(`**Feedback:** ${ann.comment}`);
    if (ann.stale) {
      lines.push(`> ⚠️ Note: This annotation was made on a previous revision.`);
    }
    lines.push(``);
  });

  lines.push(`---`);
  lines.push(``);
  lines.push(`After applying all feedback, push the revised document using \`md_push\` with documentId \`${doc.documentId}\`.`);
  return lines.join('\n');
}

export default function PromptGenerator({ doc, annotations, onClose }) {
  const prompt = buildPrompt(doc, annotations);
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <span>Revision Prompt</span>
          <div className="modal-header-actions">
            <Button size="small" variant="primary" onClick={copy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <Button size="small" onClick={onClose}>Close</Button>
          </div>
        </div>
        <pre className="modal-body">{prompt}</pre>
      </div>
    </div>
  );
}
