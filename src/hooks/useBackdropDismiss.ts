import { useCallback, useRef, type MouseEvent, type RefObject, type TouchEvent } from 'react';

export function useBackdropDismiss<T extends HTMLElement>(
  contentRef: RefObject<T | null>,
  onDismiss: () => void,
  enabled = true,
) {
  const pressStartedOnBackdropRef = useRef(false);

  const handlePointerStart = useCallback((event: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
    if (!enabled) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    const startedInsideContent = Boolean(contentRef.current?.contains(target));
    pressStartedOnBackdropRef.current = !startedInsideContent;
  }, [contentRef, enabled]);

  const handlePointerEnd = useCallback((event: MouseEvent<HTMLElement> | TouchEvent<HTMLElement>) => {
    if (!enabled) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Node)) {
      return;
    }

    if (!pressStartedOnBackdropRef.current) {
      return;
    }

    const endedInsideContent = Boolean(contentRef.current?.contains(target));
    pressStartedOnBackdropRef.current = false;

    if (!endedInsideContent) {
      onDismiss();
    }
  }, [contentRef, enabled, onDismiss]);

  const handleMouseLeave = useCallback(() => {
    pressStartedOnBackdropRef.current = false;
  }, []);

  return {
    handleMouseDown: handlePointerStart,
    handleMouseUp: handlePointerEnd,
    handleTouchStart: handlePointerStart,
    handleTouchEnd: handlePointerEnd,
    handleMouseLeave,
  };
}
