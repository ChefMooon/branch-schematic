import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { useState, type ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import './SearchBar.css';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  label?: string;
  ariaLabel?: string;
  helperText?: ReactNode;
  className?: string;
  containerStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  clearButtonLabel?: string;
  clearButtonClassName?: string;
  showIcon?: boolean;
  showShellBorder?: boolean;
  showFocusRing?: boolean;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  onKeyDown,
  placeholder = 'Search',
  label,
  ariaLabel,
  helperText,
  className,
  containerStyle,
  inputStyle,
  clearButtonLabel = 'Clear search',
  clearButtonClassName,
  showIcon = true,
  showShellBorder = true,
  showFocusRing = true,
  disabled = false,
}: SearchBarProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }

    onChange('');
  };

  const shellStyle: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    minWidth: 0,
    height: '100%',
    border: showShellBorder ? '1px solid var(--app-border)' : 'none',
    borderRadius: 8,
    background: disabled
      ? 'var(--app-surface-muted)'
      : showShellBorder
        ? (isFocused ? 'var(--app-surface)' : isHovered ? 'color-mix(in srgb, var(--app-accent) 10%, transparent)' : 'var(--app-surface-muted)')
        : 'transparent',
    boxShadow: showFocusRing && isFocused ? '0 0 0 2px color-mix(in srgb, var(--app-accent) 18%, transparent)' : 'none',
    transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
  };

  return (
    <div className={className} style={containerStyle}>
      <label style={{ display: 'grid', gap: 6, width: '100%' }}>
        {label ? <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--app-text)' }}>{label}</span> : null}
        <div
          style={shellStyle}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {showIcon ? <MagnifyingGlass size={14} weight="bold" style={{ position: 'absolute', left: 10, color: 'var(--app-muted)', pointerEvents: 'none' }} /> : null}
          <input
            type="text"
            value={value}
            onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder={placeholder}
            aria-label={ariaLabel ?? label}
            style={{
              width: '100%',
              height: '100%',
              boxSizing: 'border-box',
              borderRadius: 8,
              border: 'none',
              padding: showIcon ? '8px 32px 8px 32px' : '8px 32px 8px 10px',
              fontSize: 13,
              background: 'transparent',
              color: 'var(--app-text)',
              outline: 'none',
              boxShadow: 'none',
              lineHeight: 1.2,
              ...inputStyle,
            }}
            disabled={disabled}
          />
          {value.trim().length > 0 ? (
            <button
              type="button"
              onClick={handleClear}
              className={clearButtonClassName ? `search-bar-clear-button ${clearButtonClassName}` : 'search-bar-clear-button'}
              aria-label={clearButtonLabel}
              title={clearButtonLabel}
              disabled={disabled}
              style={{
                position: 'absolute',
                right: 6,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                padding: 0,
                borderRadius: 8,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, opacity 160ms ease',
              }}
            >
              <X size={14} weight="bold" />
            </button>
          ) : null}
        </div>
      </label>
      {helperText ? <div style={{ marginTop: 6, fontSize: 11, color: 'var(--app-muted)' }}>{helperText}</div> : null}
    </div>
  );
}
