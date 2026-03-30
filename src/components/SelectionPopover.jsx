import { useState, useEffect, useRef, useCallback } from 'react';
import { Button, IconButton, Textarea } from '@primer/react';
import { XIcon } from '@primer/octicons-react';

function findLineRange(node) {
  let el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  while (el) {
    const start = el.dataset?.lineStart;
    if (start) {
      return {
        start: parseInt(start, 10),
        end: parseInt(el.dataset.lineEnd ?? start, 10),
      };
    }
    el = el.parentElement;
  }
  return null;
}

function getLineRangeForSelection(selection) {
  if (!selection || selection.isCollapsed) return null;
  const anchorRange = findLineRange(selection.anchorNode);
  const focusRange = findLineRange(selection.focusNode);
  if (!anchorRange && !focusRange) return null;
  const startLine = Math.min(anchorRange?.start ?? Infinity, focusRange?.start ?? Infinity);
  const endLine = Math.max(anchorRange?.end ?? 0, focusRange?.end ?? 0);
  return { startLine, endLine };
}

export default function SelectionPopover({ containerRef, documentContent, onAnnotate }) {
  const [popover, setPopover] = useState(null);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  const handleMouseUp = useCallback((e) => {
    if (e.target.closest?.('.selection-popover')) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) { setPopover(null); return; }
    const selectedText = selection.toString().trim();
    if (!selectedText) return;
    if (!containerRef.current?.contains(selection.anchorNode)) return;
    const lineRange = getLineRangeForSelection(selection);
    if (!lineRange) return;
    const { startLine, endLine } = lineRange;
    const lines = documentContent.split('\n');
    const rawSource = lines.slice(startLine - 1, endLine).join('\n');
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPopover({ x: rect.left + rect.width / 2, y: rect.bottom + window.scrollY + 8, startLine, endLine, selectedText, rawSource });
    setComment('');
  }, [containerRef, documentContent]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  useEffect(() => {
    if (popover) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [popover]);

  function dismiss() {
    setPopover(null);
    setComment('');
    window.getSelection()?.removeAllRanges();
  }

  async function submit() {
    if (!comment.trim() || !popover) return;
    setSaving(true);
    try {
      await onAnnotate({
        startLine: popover.startLine,
        endLine: popover.endLine,
        selectedText: popover.selectedText,
        rawSource: popover.rawSource,
        comment: comment.trim(),
      });
      dismiss();
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') dismiss();
  }

  if (!popover) return null;

  return (
    <div className="selection-popover" style={{ left: popover.x, top: popover.y }}>
      <div className="popover-header">
        <span className="popover-line-range">Lines {popover.startLine}–{popover.endLine}</span>
        <IconButton icon={XIcon} variant="invisible" size="small" aria-label="Dismiss" onClick={dismiss} />
      </div>
      <div className="popover-quote">
        "{popover.selectedText.slice(0, 80)}{popover.selectedText.length > 80 ? '…' : ''}"
      </div>
      <Textarea
        ref={textareaRef}
        placeholder="Leave a comment..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
        block
        resize="vertical"
      />
      <div className="popover-footer">
        <span className="popover-hint">⌘↵ to save</span>
        <Button variant="primary" size="small" onClick={submit} disabled={saving || !comment.trim()}>
          {saving ? 'Saving…' : 'Add comment'}
        </Button>
      </div>
    </div>
  );
}
