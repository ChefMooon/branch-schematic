export interface ViewportState {
  zoom: number;
  x: number;
  y: number;
}

interface ShouldApplyStoredViewportInput {
  activeViewId: string | null;
  nextViewport: ViewportState;
  lastAppliedViewId: string | null;
  lastAppliedViewport: ViewportState;
}

export function shouldApplyStoredViewport({
  activeViewId,
  nextViewport,
  lastAppliedViewId,
  lastAppliedViewport,
}: ShouldApplyStoredViewportInput) {
  if (!activeViewId) return false;

  if (lastAppliedViewId !== activeViewId) return true;

  const zoomChanged = Math.abs(nextViewport.zoom - lastAppliedViewport.zoom) > 1e-6;
  const xChanged = Math.abs(nextViewport.x - lastAppliedViewport.x) > 1e-6;
  const yChanged = Math.abs(nextViewport.y - lastAppliedViewport.y) > 1e-6;

  return zoomChanged || xChanged || yChanged;
}
