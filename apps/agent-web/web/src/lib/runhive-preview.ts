/** Preview tickets authorize only one tenant-owned application directory, never platform APIs. */
export function previewSource(source: string, origin: string): string {
  const url = new URL(source, origin);
  if (url.origin !== origin || url.username || url.password || url.hash || !url.pathname.startsWith('/llm-center/agent/api/') || url.toString().length > 8192) throw new Error('预览来源无效。');
  return url.pathname + url.search;
}
export function previewUrl(urlValue: string, origin: string): string {
  const url = new URL(urlValue, origin);
  const match = /^\/llm-center\/agent\/preview\/[a-f0-9]{64}\/([^/]+)$/.exec(url.pathname);
  const entry = match ? decodeURIComponent(match[1] ?? '') : '';
  if (url.origin !== origin || url.username || url.password || url.search || url.hash || !match
    || entry.includes('/') || entry.includes('\\') || /[\x00-\x1f\x7f]/u.test(entry) || !/\.html?$/i.test(entry)) throw new Error('预览地址无效。');
  return url.pathname;
}
