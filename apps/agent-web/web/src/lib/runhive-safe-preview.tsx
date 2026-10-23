import { forwardRef, useEffect, useState } from 'react';
import type { ComponentPropsWithoutRef } from 'react';
import { previewSource, previewUrl } from './runhive-preview';

interface PreviewState { source: string; reloadKey?: string; url?: string; error?: string }
function usePreviewCapability(source: string, reloadKey?: string): PreviewState {
  const [state, setState] = useState<{ source: string; reloadKey?: string; url?: string; error?: string }>({ source });
  useEffect(() => {
    let active = true, currentUrl = '';
    let next: ReturnType<typeof setTimeout> | undefined;
    let currentRequest: AbortController | undefined;
    setState({ source, ...(reloadKey === undefined ? {} : { reloadKey }) });
    const request = async () => {
      const controller = new AbortController(); currentRequest = controller;
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const response = await fetch('/llm-center/agent/auth/preview', { method: 'POST', credentials: 'same-origin', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: previewSource(source, location.origin), ...(currentUrl ? { renew_url: currentUrl } : {}) }) });
        const result = await response.json() as { url?: string; detail?: string };
        if (!response.ok || typeof result.url !== 'string') {
          if (typeof result.detail === 'string' && result.detail.includes('独立') && result.detail.includes('目录')) throw new Error('请将页面及其资源放入独立子目录后预览。');
          throw new Error('预览暂时不可用，请重新打开文件。');
        }
        const url = previewUrl(result.url, location.origin);
        if (!active) return;
        currentUrl = url;
        setState({ source, ...(reloadKey === undefined ? {} : { reloadKey }), url });
        // Extend the same capability; keeping src unchanged preserves application state.
        next = setTimeout(() => void request(), 90000);
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error && error.message === '请将页面及其资源放入独立子目录后预览。'
          ? error.message : '预览暂时不可用，请重新打开文件。';
        if (!currentUrl) setState({ source, ...(reloadKey === undefined ? {} : { reloadKey }), error: message });
        else next = setTimeout(() => void request(), 10000);
      } finally { clearTimeout(timeout); }
    };
    void request();
    return () => { active = false; clearTimeout(next); currentRequest?.abort(); };
  }, [source, reloadKey]);
  return state.source === source && state.reloadKey === reloadKey ? state : { source };
}

type SafePreviewProps = Omit<ComponentPropsWithoutRef<'iframe'>, 'src' | 'srcDoc' | 'sandbox'> & { source: string; reloadKey?: string };
export const SafePreview = forwardRef<HTMLIFrameElement, SafePreviewProps>(function SafePreview({ source, reloadKey, className, ...props }, ref) {
  const state = usePreviewCapability(source, reloadKey);
  if (!state.url) return <div role={state.error ? 'alert' : 'status'} className={`flex items-center justify-center p-6 text-gray-500 ${className?.replace(/(?:^|\s)opacity-\d+\b/g, '') ?? ''}`}>{state.error || '正在准备预览…'}</div>;
  return <iframe {...props} ref={ref} src={state.url} sandbox="allow-scripts allow-forms" className={className} />;
});

export function SafePreviewLink({ source, title, className, children }: { source: string; title: string; className?: string; children: React.ReactNode }) {
  const state = usePreviewCapability(source);
  return state.url ? <a href={state.url} target="_blank" rel="noopener noreferrer" aria-label={title} className={className}>{children}</a>
    : <button type="button" disabled aria-label={state.error || '正在准备预览…'} className={className}>{children}</button>;
}
