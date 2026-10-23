/** Render a managed vision reply as a marked photo, with a lossless full-resolution PNG export. */
import { useEffect, useState } from "react";
import { Button, Spinner } from "@prismshadow/penguin-ui";
import { routedUrl } from "../../lib/session-machines";
import { bboxImagePath, drawBboxImage } from "./bbox-result";
import type { BboxResult } from "./bbox-result";
import { BboxImageOverlay } from "./bbox-image-overlay";
import { BboxImageViewer } from "./bbox-image-viewer";

interface LoadedImage { key: string; url: string; image: HTMLImageElement }

export function BboxImageResult({ result, sessionId }: { result: BboxResult; sessionId: string }) {
  const path = bboxImagePath(sessionId, result);
  const key = `${path ?? "invalid"}:${result.image_size.width}x${result.image_size.height}`;
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [coordinatesOpen, setCoordinatesOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [viewerIdentity, setViewerIdentity] = useState<string | null>(null);
  const identity = `${key}:${JSON.stringify(result)}`;
  const ready = loaded?.key === key ? loaded : null;

  useEffect(() => { setViewerIdentity(null); }, [identity]);

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoaded(null);
    setLoadError(null);
    setDownloadError(null);
    const load = async () => {
      if (path === null) throw new Error("图片所属会话无效，请重新打开对话。");
      const response = await fetch(routedUrl(path), { credentials: "same-origin", signal: controller.signal });
      if (!response.ok) throw new Error("原图读取失败，请重新加载。");
      if (!/^image\/(png|jpeg|webp)(?:;|$)/i.test(response.headers.get("content-type") ?? "")) {
        throw new Error("原图内容无效，请重新加载。");
      }
      const blob = await response.blob();
      if (cancelled) return;
      if (blob.size === 0 || blob.size > 7 * 1024 * 1024) throw new Error("原图内容无效，请重新加载。");
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("原图无法显示，请重新加载。"));
        image.src = objectUrl!;
      });
      if (cancelled) return;
      if (image.naturalWidth !== result.image_size.width || image.naturalHeight !== result.image_size.height) {
        throw new Error("原图尺寸与识别结果不一致，无法显示标注。");
      }
      setLoaded({ key, url: objectUrl, image });
    };
    void load().catch((error: unknown) => {
      if (!cancelled) setLoadError(error instanceof Error ? error.message : "原图读取失败，请重新加载。");
    });
    return () => {
      cancelled = true;
      controller.abort();
      if (objectUrl !== null) URL.revokeObjectURL(objectUrl);
    };
  }, [key, path, attempt]);

  const download = async () => {
    if (ready === null || downloading) return;
    setDownloading(true);
    setDownloadError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = result.image_size.width;
      canvas.height = result.image_size.height;
      const context = canvas.getContext("2d");
      if (context === null) throw new Error("图片导出失败，请重试。");
      drawBboxImage(context, ready.image, result);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((output) => output === null ? reject(new Error("图片导出失败，请重试。")) : resolve(output), "image/png");
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `标注结果-${result.image_id.slice(7, 19)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Keep the source URL intact: the marked preview remains visible after an export.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setDownloadError("图片导出失败，请重试。");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="anim-msg my-3 max-w-3xl overflow-hidden rounded-xl border border-line bg-surface" aria-label="图片识别结果">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="text-sm font-medium text-fg">
          {result.detections.length === 0 ? "识别结果 · 未识别到目标" : `识别结果 · ${result.detections.length} 个目标`}
        </span>
        <div className="flex flex-wrap items-center gap-1">
          <Button variant="ghost" size="sm" aria-expanded={coordinatesOpen} onClick={() => setCoordinatesOpen(!coordinatesOpen)}>
            {coordinatesOpen ? "收起坐标" : "查看坐标"}
          </Button>
          <Button variant="secondary" size="sm" disabled={ready === null} loading={downloading} loadingLabel="正在导出图片" onClick={() => void download()}>
            下载标注图片
          </Button>
        </div>
      </div>
      {ready !== null ? (
        <button type="button" aria-label="放大标注图片" aria-haspopup="dialog" onClick={() => setViewerIdentity(identity)} className="relative block w-full cursor-zoom-in overflow-hidden" style={{ aspectRatio: `${result.image_size.width} / ${result.image_size.height}` }}>
          <img src={ready.url} alt="识别结果原图" draggable={false} className="block h-full w-full object-contain" />
          <BboxImageOverlay result={result} />
        </button>
      ) : (
        <div className="flex min-h-44 items-center justify-center gap-2 bg-surface-muted px-4 py-8 text-sm text-fg-muted" role="status">
          {loadError !== null ? <><span>{loadError}</span><Button variant="secondary" size="sm" onClick={() => setAttempt(attempt + 1)}>重新加载</Button></> : <><Spinner size="sm" label="正在加载标注图片" /><span>正在加载标注图片</span></>}
        </div>
      )}
      {downloadError !== null && <p className="px-3 py-2 text-sm text-tone-danger-fg" role="alert">{downloadError}</p>}
      {coordinatesOpen && <pre className="m-0 max-h-60 overflow-auto border-t border-line bg-surface-muted p-3 font-mono text-xs text-fg-muted">{JSON.stringify(result, null, 2)}</pre>}
      {ready !== null && <BboxImageViewer open={viewerIdentity === identity} imageUrl={ready.url} result={result} onClose={() => setViewerIdentity(null)} onDownload={() => void download()} downloading={downloading} downloadError={downloadError} />}
    </section>
  );
}
