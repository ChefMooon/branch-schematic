import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Tag, X } from '@phosphor-icons/react';
import { useClickOutside } from '../../../hooks/useClickOutside';
import { Button } from '../../../components/button/Button';
import type { RepoTag } from '../../../types/git';

type TagFiltersPopoverProps = {
  isOpen: boolean;
  onClose: () => void;
  tags: RepoTag[];
  activeTagFilters: string[];
  onToggleTag: (tagId: string) => void;
  onClearAll: () => void;
  onClearCurrentView?: () => void;
  tagUsageCounts?: Record<string, number>;
};

export function TagFiltersPopover({
  isOpen,
  onClose,
  tags,
  activeTagFilters,
  onToggleTag,
  onClearAll,
  onClearCurrentView,
  tagUsageCounts = {},
}: TagFiltersPopoverProps) {
  const [isVisible, setIsVisible] = useState(isOpen);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) {
      const timeout = window.setTimeout(() => {
        setIsVisible(false);
      }, 140);
      return () => window.clearTimeout(timeout);
    }

    setIsVisible(true);
  }, [isOpen]);

  useClickOutside(panelRef, onClose, isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const sortedTags = useMemo(() => {
    return [...tags].sort((left, right) => left.tag_name.localeCompare(right.tag_name, undefined, { sensitivity: 'base' }));
  }, [tags]);

  if (!isVisible) return null;

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      style={{
        position: 'absolute',
        right: '0',
        top: 'calc(100% + 6px)',
        width: '220px',
        backgroundColor: 'var(--app-surface)',
        border: '1px solid var(--app-border)',
        borderRadius: '10px',
        boxShadow: '0 12px 26px -12px var(--app-shadow)',
        padding: '10px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        maxHeight: 'min(320px, 60vh)',
        opacity: isOpen ? 1 : 0,
        transform: isOpen ? 'translateY(0)' : 'translateY(-4px)',
        transition: 'opacity 140ms ease, transform 140ms ease',
        zIndex: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Tag size={14} weight="bold" color="var(--app-accent)" />
          <div id={titleId} style={{ fontSize: '11px', fontWeight: 700, color: 'var(--app-text)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Tag Filters
          </div>
        </div>
        <Button type="button" variant="basic" title="Close tag filters" onClick={onClose} style={{ width: '24px', height: '24px', padding: 0 }}>
          <X size={12} weight="bold" />
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ fontSize: '11px', color: 'var(--app-muted)' }}>
          {activeTagFilters.length > 0 ? `${activeTagFilters.length} active` : 'All tags'}
        </div>
        <Button
          type="button"
          variant="menu-item"
          onClick={() => {
            onClearAll();
            onClose();
          }}
          style={{ width: 'auto', padding: '4px 8px', fontSize: '11px', justifyContent: 'center' }}
          aria-label="Clear all"
        >
          Clear All
        </Button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', overscrollBehavior: 'contain' }}>
        {sortedTags.map((tag) => {
          const isActive = activeTagFilters.includes(tag.id);
          const usageCount = tagUsageCounts[tag.id] ?? 0;

          return (
            <label
              key={tag.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                padding: '6px 8px',
                borderRadius: '8px',
                border: `1px solid ${isActive ? tag.color_hex : 'var(--app-border)'}`,
                backgroundColor: isActive ? `${tag.color_hex}22` : 'var(--app-surface-muted)',
                color: 'var(--app-text)',
                cursor: 'pointer',
                transition: 'background-color 0.16s ease, border-color 0.16s ease',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => onToggleTag(tag.id)}
                  aria-label={tag.tag_name}
                  style={{ accentColor: tag.color_hex, cursor: 'pointer' }}
                />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tag.tag_name}</span>
              </span>
              <span style={{ fontSize: '10px', color: 'var(--app-muted)', whiteSpace: 'nowrap' }}>
                {usageCount > 0 ? `${usageCount}` : '—'}
              </span>
            </label>
          );
        })}
      </div>

      {onClearCurrentView ? (
        <Button
          type="button"
          variant="menu-item"
          onClick={() => {
            onClearCurrentView();
            onClose();
          }}
          style={{ justifyContent: 'center', fontSize: '11px', color: 'var(--app-muted)' }}
        >
          Clear current view
        </Button>
      ) : null}
    </div>
  );
}
