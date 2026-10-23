/** A marked-photo viewer on the official dialog layer, retaining its Escape and focus behavior. */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, Modal } from "@prismshadow/penguin-ui";
import type { BboxResult } from "./bbox-result";
import { BboxImageOverlay } from "./bbox-image-overlay";
import { clampBboxZoom, fitBboxZoom, MAX_BBOX_ZOOM, MIN_BBOX_ZOOM, zoomedBboxSize } from "./bbox-viewer-geometry";

export interface BboxImageViewerProps {
  open: boolean;
  imageUrl: string;
  result: BboxResult;
  onClose: () => void;
  onDownload: () => void;
  downloading: boolean;
  downloadError?: string | null;
}

export function BboxImageViewer({ open, imageUrl, result, onClose, onDownload, downloading, downloadError }: BboxImageViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null);
  const anchor = useRef<{ x: number; y: number } | null>(null);
  const { width, height } = result.image_size;
  const size = zoomedBboxSize(width, height, zoom);

  // Opening and resizing in fit mode show the entire raster. Original-size/zoom modes keep the user's scale.
  useLayoutEffect(() => {
    if (!open) return;
    const viewport = viewportRef.current;
    if (viewport === null) return;
    const measure = () => {
      if (!fit) return;
      const style = getComputedStyle(viewport);
      const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      setZoom(fitBboxZoom(width, height, viewport.clientWidth - horizontalPadding, viewport.clientHeight - verticalPadding));
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [open, fit, width, height]);

  useEffect(() => {
    if (!open) {
      setFit(true);
      setDragging(false);
      drag.current = null;
      anchor.current = null;
    }
  }, [open]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const layer = layerRef.current;
    const point = anchor.current;
    if (viewport === null || layer === null || point === null) return;
    anchor.current = null;
    viewport.scrollLeft = layer.offsetLeft + point.x * zoom - viewport.clientWidth / 2;
    viewport.scrollTop = layer.offsetTop + point.y * zoom - viewport.clientHeight / 2;
  }, [zoom]);

  const changeZoom = (next: number) => {
    const viewport = viewportRef.current;
    const layer = layerRef.current;
    if (viewport !== null && layer !== null) {
      anchor.current = {
        x: (viewport.scrollLeft + viewport.clientWidth / 2 - layer.offsetLeft) / zoom,
        y: (viewport.scrollTop + viewport.clientHeight / 2 - layer.offsetTop) / zoom,
      };
    }
    setFit(false);
    setZoom(clampBboxZoom(next));
  };

  return (
    <Modal open={open} title="标注图片" closeLabel="关闭" onClose={onClose} bare fullScreenOnPhone widthClass="sm:max-w-[calc(100vw-2rem)] sm:w-[min(92vw,1280px)] sm:h-[88dvh]">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2" data-testid="bbox-viewer-toolbar">
        <Button size="sm" onClick={() => changeZoom(zoom / 1.25)} disabled={zoom <= MIN_BBOX_ZOOM}>缩小</Button>
        <output className="min-w-12 text-center text-xs tabular-nums text-fg-muted" data-testid="bbox-viewer-zoom">{Math.round(zoom * 100)}%</output>
        <Button size="sm" onClick={() => changeZoom(zoom * 1.25)} disabled={zoom >= MAX_BBOX_ZOOM}>放大</Button>
        <Button size="sm" aria-pressed={fit} onClick={() => { anchor.current = null; setFit(true); }}>适应窗口</Button>
        <Button size="sm" aria-pressed={!fit && zoom === 1} onClick={() => changeZoom(1)}>原始尺寸</Button>
        <span className="text-xs text-fg-subtle">{width} × {height}</span>
        <Button size="sm" variant="secondary" loading={downloading} loadingLabel="正在导出图片" onClick={onDownload} className="ml-auto">下载标注图片</Button>
      </div>
      <div
        ref={viewportRef}
        data-testid="bbox-viewer-viewport"
        aria-label="标注图片查看区域"
        tabIndex={0}
        className={`relative min-h-0 flex-1 select-none overflow-auto overscroll-contain bg-surface-muted p-4 ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || event.button !== 0) return;
          drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop };
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          event.preventDefault();
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (start === null || start.pointerId !== event.pointerId) return;
          event.currentTarget.scrollLeft = start.left - (event.clientX - start.x);
          event.currentTarget.scrollTop = start.top - (event.clientY - start.y);
        }}
        onPointerUp={(event) => {
          if (drag.current?.pointerId !== event.pointerId) return;
          drag.current = null;
          setDragging(false);
          if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
      >
        <div className="flex min-h-full min-w-full items-center justify-center" style={{ width: size.width, height: size.height }}>
          <div ref={layerRef} className="relative shrink-0" data-testid="bbox-viewer-image" style={{ width: size.width, height: size.height }}>
            <img src={imageUrl} alt="放大的标注图片原图" draggable={false} className="block h-full w-full" />
            <BboxImageOverlay result={result} />
          </div>
        </div>
      </div>
      {downloadError && <p className="shrink-0 border-t border-line bg-surface px-3 py-2 text-sm text-tone-danger-fg" role="alert">{downloadError}</p>}
    </Modal>
  );
}
