/** Zoom changes the whole original-pixel photo/overlay layer; individual boxes never get rescaled twice. */
export const MIN_BBOX_ZOOM = 0.01;
export const MAX_BBOX_ZOOM = 8;

export function clampBboxZoom(value: number): number {
  return Number.isFinite(value) ? Math.max(MIN_BBOX_ZOOM, Math.min(MAX_BBOX_ZOOM, value)) : 1;
}

export function fitBboxZoom(width: number, height: number, availableWidth: number, availableHeight: number): number {
  if (![width, height, availableWidth, availableHeight].every((value) => Number.isFinite(value) && value > 0)) return 1;
  return clampBboxZoom(Math.min(1, availableWidth / width, availableHeight / height));
}

export function zoomedBboxSize(width: number, height: number, zoom: number): { width: number; height: number } {
  const scale = clampBboxZoom(zoom);
  return { width: width * scale, height: height * scale };
}
