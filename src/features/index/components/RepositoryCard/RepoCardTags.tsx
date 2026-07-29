import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CaretDown,
  X,
  TagIcon,
} from '@phosphor-icons/react';
import type { RepoTag } from '../../../../types/git';

type RepoCardTagsProps = {
  tags: RepoTag[];
  isAnyLoading: boolean;
  onOpenTagModal: () => void;
  onRemoveTag: (tagName: string) => Promise<void>;
};

const INLINE_LIMIT = 2;

export function RepoCardTags({ tags, isAnyLoading, onOpenTagModal, onRemoveTag }: RepoCardTagsProps) {
  const orderedTags = useMemo(() => {
    return [...tags].sort((a, b) => a.tag_name.localeCompare(b.tag_name, undefined, { sensitivity: 'base' }));
  }, [tags]);
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [isPinnedOpen, setIsPinnedOpen] = useState(false);
  const [inlineLimit, setInlineLimit] = useState(2);
  const tagsSectionRef = useRef<HTMLDivElement>(null);
  const overflowTriggerRef = useRef<HTMLButtonElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = tagsSectionRef.current;
    if (!container || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setInlineLimit(width < 320 ? 1 : 2);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isOverflowOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        overflowMenuRef.current &&
        !overflowMenuRef.current.contains(target) &&
        overflowTriggerRef.current &&
        !overflowTriggerRef.current.contains(target)
      ) {
        setIsOverflowOpen(false);
        setIsPinnedOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOverflowOpen]);

  const visibleTags = orderedTags.slice(0, inlineLimit);
  const hiddenTags = orderedTags.slice(inlineLimit);
  const overflowCount = hiddenTags.length;
  const shouldShowOverflow = overflowCount > 0;

  const clearHoverTimer = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const openOverflow = () => {
    clearHoverTimer();
    setIsOverflowOpen(true);
  };

  const scheduleOpen = () => {
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      openOverflow();
    }, 120);
  };

  const scheduleClose = () => {
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      if (!isPinnedOpen) {
        setIsOverflowOpen(false);
      }
    }, 180);
  };

  const handleTriggerMouseEnter = () => {
    scheduleOpen();
  };

  const handleTriggerMouseLeave = () => {
    if (!isPinnedOpen) {
      scheduleClose();
    }
  };

  const handleMenuMouseEnter = () => {
    clearHoverTimer();
    openOverflow();
  };

  const handleMenuMouseLeave = () => {
    if (!isPinnedOpen) {
      scheduleClose();
    }
  };

  const handleTriggerFocus = () => {
    openOverflow();
  };

  const handleTriggerBlur = () => {
    if (!isPinnedOpen) {
      setIsOverflowOpen(false);
    }
  };

  const handleTriggerClick = () => {
    setIsPinnedOpen((prev) => {
      const next = !prev;
      setIsOverflowOpen(next);
      return next;
    });
  };

  return (
    <div className="repo-tags-section" ref={tagsSectionRef}>
      <div className="repo-tags-list">
        {visibleTags.map((tag) => (
          <span key={tag.id} className="repo-tag-pill" style={{ borderColor: tag.color_hex, backgroundColor: `${tag.color_hex}1a` }}>
            <span className="repo-tag-dot" style={{ backgroundColor: tag.color_hex }} />
            {tag.tag_name}
            <button
              type="button"
              className="repo-tag-remove"
              onClick={() => void onRemoveTag(tag.tag_name)}
              disabled={isAnyLoading}
              title={`Remove ${tag.tag_name}`}
              aria-label={`Remove ${tag.tag_name}`}
            >
              <X size={10} weight="bold" />
            </button>
          </span>
        ))}

        {shouldShowOverflow ? (
          <div
            className="repo-tag-overflow-wrapper"
            onMouseEnter={handleTriggerMouseEnter}
            onMouseLeave={handleTriggerMouseLeave}
            onFocus={handleTriggerFocus}
            onBlur={handleTriggerBlur}
          >
            <button
              type="button"
              ref={overflowTriggerRef}
              className="repo-tag-overflow"
              onClick={handleTriggerClick}
              aria-expanded={isOverflowOpen}
              aria-haspopup="dialog"
              title="Show all tags"
            >
              <span>+{overflowCount} more</span>
              <CaretDown size={10} weight="bold" />
            </button>
            <div
              ref={overflowMenuRef}
              className={`repo-tag-overflow-menu${isOverflowOpen ? ' is-open' : ''}`}
              role="dialog"
              aria-label="Repository tags"
              aria-hidden={!isOverflowOpen}
              onMouseEnter={handleMenuMouseEnter}
              onMouseLeave={handleMenuMouseLeave}
            >
              {hiddenTags.map((tag) => (
                <div key={tag.id} className="repo-tag-overflow-item">
                  <span className="repo-tag-pill repo-tag-pill--compact" style={{ borderColor: tag.color_hex, backgroundColor: `${tag.color_hex}1a` }}>
                    <span className="repo-tag-dot" style={{ backgroundColor: tag.color_hex }} />
                    {tag.tag_name}
                    <button
                      type="button"
                      className="repo-tag-remove repo-tag-remove--inside"
                      onClick={() => void onRemoveTag(tag.tag_name)}
                      disabled={isAnyLoading}
                      title={`Remove ${tag.tag_name}`}
                      aria-label={`Remove ${tag.tag_name}`}
                    >
                      <X size={10} weight="bold" />
                    </button>
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="repo-tag-add"
          onClick={onOpenTagModal}
          disabled={isAnyLoading}
        >
          <TagIcon size={12} weight="bold" />
        </button>
      </div>
    </div>
  );
}
