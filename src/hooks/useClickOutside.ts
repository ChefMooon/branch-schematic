import { type RefObject, useEffect } from 'react';

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onClickOutside: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handlePointerDown = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      if (ref.current?.contains(target)) {
        return;
      }

      onClickOutside();
    };

    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('touchstart', handlePointerDown, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('touchstart', handlePointerDown, true);
    };
  }, [enabled, onClickOutside, ref]);
}
