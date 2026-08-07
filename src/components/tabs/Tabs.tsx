import { useId, useRef } from 'react';
import './Tabs.css';

export type TabItem<T extends string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

type TabsProps<T extends string> = {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  idPrefix?: string;
  className?: string;
};

export function Tabs<T extends string>({ items, value, onChange, ariaLabel, idPrefix, className }: TabsProps<T>) {
  const generatedId = useId();
  const baseId = idPrefix ?? `tabs-${generatedId.replace(/:/g, '')}`;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const classes = ['tabs', className].filter(Boolean).join(' ');

  const focusTab = (index: number) => {
    const enabledItems = items.filter((item) => !item.disabled);
    if (enabledItems.length === 0) return;

    const currentIndex = enabledItems.findIndex((item) => item.value === value);
    const nextIndex = (currentIndex + index + enabledItems.length) % enabledItems.length;
    const nextItem = enabledItems[nextIndex];
    const nextItemIndex = items.findIndex((item) => item.value === nextItem.value);
    onChange(nextItem.value);
    tabRefs.current[nextItemIndex]?.focus();
  };

  return (
    <div className={classes} role="tablist" aria-label={ariaLabel}>
      {items.map((item, index) => {
        const isActive = item.value === value;
        const tabId = `${baseId}-tab-${item.value}`;
        const panelId = `${baseId}-panel-${item.value}`;

        return (
          <button
            key={item.value}
            ref={(element) => {
              tabRefs.current[index] = element;
            }}
            type="button"
            id={tabId}
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            disabled={item.disabled}
            className={`tabs__tab${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                event.preventDefault();
                focusTab(1);
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                event.preventDefault();
                focusTab(-1);
              } else if (event.key === 'Home') {
                event.preventDefault();
                focusTab(-items.length);
              } else if (event.key === 'End') {
                event.preventDefault();
                focusTab(items.length);
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}