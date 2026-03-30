import { SegmentedControl } from '@primer/react';

export default function ModeToggle({ mode, onChange }) {
  return (
    <SegmentedControl aria-label="View mode" size="small">
      <SegmentedControl.Button
        selected={mode === 'raw'}
        onClick={() => onChange('raw')}
      >
        Raw
      </SegmentedControl.Button>
      <SegmentedControl.Button
        selected={mode === 'preview'}
        onClick={() => onChange('preview')}
      >
        Preview
      </SegmentedControl.Button>
    </SegmentedControl>
  );
}
