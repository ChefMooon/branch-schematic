export type MenuPositionInput = {
  triggerRect: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  menuHeight: number;
  menuWidth: number;
  viewportWidth: number;
  viewportHeight: number;
  viewportPadding?: number;
  gap?: number;
};

export function getViewportSafeMenuPosition({
  triggerRect,
  menuHeight,
  menuWidth,
  viewportWidth,
  viewportHeight,
  viewportPadding = 8,
  gap = 6,
}: MenuPositionInput) {
  const horizontalOffset = 32;
  const left = Math.min(
    Math.max(viewportPadding, triggerRect.right - menuWidth - horizontalOffset),
    Math.max(viewportPadding, viewportWidth - menuWidth - viewportPadding),
  );

  const spaceBelow = viewportHeight - triggerRect.bottom - viewportPadding;
  const spaceAbove = triggerRect.top - viewportPadding;
  const shouldOpenAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const preferredTop = shouldOpenAbove
    ? triggerRect.top - menuHeight - gap
    : triggerRect.bottom - 32;

  const top = Math.min(
    Math.max(viewportPadding, preferredTop),
    Math.max(viewportPadding, viewportHeight - menuHeight - viewportPadding),
  );

  return {
    top,
    left,
    maxHeight: Math.max(120, viewportHeight - viewportPadding * 2),
  };
}
