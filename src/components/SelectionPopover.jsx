import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Walk from a DOM node up to the nearest ancestor with data-line-start.
 * Returns { start, end } or null.
 */
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

/**
 * Given a Selection, return { startLine, endLine } across both endpoints.
 */
function getLineRangeForSelection(selection) {
  if (!selection || selection.isCollapsed) return null;
  const anchorRange = findLineRange(selection.anchorNode);
  const focusRange = findLineRange(selection.focusNode);
  if (!anchorRange && !focusRange) return null;
  const startLine = Math.min(
    anchorRange?.start ?? Infinity,
    focusRange?.start ?? Infinity
  );
  const endLine = Math.max(
    anchorRange?.end ?? 0,
    focusRange?.end ?? 0
  );
  return { startLine, endLine };
}

export default function SelectionPopover({ containerRef, documentContent, onAnnotate }) {
  const [popover, setPopover] = useState(null); // { x, y, startLine, endLine, selectedText, rawSource }
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef(null);

  const handleMouseUp = useCallback((e) => {
    // Ignore clicks inside the popover itself
    if (e.target.closest?.('.selection-popover')) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopover(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Ensure selection is within the preview container
    if (!containerRef.current?.contains(selection.anchorNode)) return;

    const lineRange = getLineRangeForSelection(selection);
    if (!lineRange) return;

    const { startLine, endLine } = lineRange;
    const lines = documentContent.split('\n');
    const rawSource = lines.slice(startLine - 1, endLine).join('\n');

    // Position popover at bottom of selection rect
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    setPopover({
      x: rect.left + rect.width / 2,
      y: rect.bottom + window.scrollY + 8,
      startLine,
      endLine,
      selectedText,
      rawSource,
    });
    setComment('');
  }, [containerRef, documentContent]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  // Focus textarea when popover opens
  useEffect(() => {
    if (popover) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
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
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
    if (e.key === 'Escape') dismiss();
  }

  if (!popover) return null;

  return (
    <div
      className="selection-popover"
      style={{ left: popover.x, top: popover.y }}
    >
      <div className="popover-header">
        <span className="popover-lines">Lines {popover.startLine}–{popover.endLine}</span>
        <button className="popover-close" onClick={dismiss}>✕</button>
      </div>
      <div className="popover-selected">"{popover.selectedText.slice(0, 80)}{popover.selectedText.length > 80 ? '…' : ''}"</div>
      <textarea
        ref={textareaRef}
        className="popover-textarea"
        placeholder="Your feedback..."
        value={comment}
        onChange={e => setComment(e.target.value)}
        onKeyDown={onKeyDown}
        rows={3}
      />
      <div className="popover-footer">
        <span className="popover-hint">⌘↵ to save · Esc to cancel</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={submit}
          disabled={saving || !comment.trim()}
        >
          {saving ? 'Saving…' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
