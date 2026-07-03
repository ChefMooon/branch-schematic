import { useMemo, useState } from 'react';

type ColorPickerProps = {
  value: string | null;
  onChange: (value: string | null) => void;
};

const normalizeHex = (value: string | null | undefined) => {
  if (!value) return '#4F46E5';
  const trimmed = value.trim();
  if (!trimmed) return '#4F46E5';
  const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : '#4F46E5';
};

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [draft, setDraft] = useState(() => normalizeHex(value));
  const presetColors = useMemo(() => ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6', '#14B8A6'], []);

  const commitHex = (next: string | null) => {
    const normalized = normalizeHex(next);
    setDraft(normalized);
    onChange(normalized);
  };

  return (
    <div
      className="theme-picker-shell"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="theme-picker-swatch" style={{ background: draft }} />
      <input
        type="text"
        className="theme-picker-input"
        value={draft}
        maxLength={7}
        onChange={(event) => {
          const nextValue = event.target.value;
          setDraft(nextValue);
          if (/^#?[0-9a-fA-F]{0,6}$/.test(nextValue)) {
            onChange(nextValue ? normalizeHex(nextValue) : null);
          }
        }}
        onBlur={() => commitHex(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commitHex(draft);
          }
        }}
      />
      <div className="theme-picker-presets">
        {presetColors.map((color) => (
          <button
            key={color}
            type="button"
            className="theme-picker-preset"
            style={{ backgroundColor: color }}
            onClick={() => commitHex(color)}
            aria-label={`Select ${color}`}
          />
        ))}
      </div>
    </div>
  );
}
