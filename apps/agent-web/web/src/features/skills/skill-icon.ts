/** Custom SVG icons enter the trusted workbench DOM; accept static shapes only. */
const SVG_NS = 'http://www.w3.org/2000/svg';
const SHAPES = new Set(['svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'title', 'desc']);
const ATTRIBUTES = new Set(['viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'fill-rule', 'clip-rule', 'opacity', 'fill-opacity', 'stroke-opacity', 'transform', 'd', 'points', 'x', 'y', 'x1', 'x2', 'y1', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'aria-hidden', 'role']);
export function sanitizeSkillIcon(svg: string | undefined): string | null {
  if (!svg || svg.length > 16384 || typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') return null;
  const text = svg.trim();
  if (!/^<svg[\s>]/i.test(text)) return null;
  try {
    const document = new DOMParser().parseFromString(text, 'image/svg+xml');
    const root = document.documentElement;
    if (document.getElementsByTagName('parsererror').length > 0 || root.localName !== 'svg') return null;
    for (const node of [root, ...Array.from(root.getElementsByTagName('*'))]) {
      if (!SHAPES.has(node.localName) || (node.namespaceURI != null && node.namespaceURI !== SVG_NS)) return null;
      for (const attr of Array.from(node.attributes)) {
        if (attr.name === 'xmlns' && node === root && attr.value === SVG_NS) continue;
        if (!ATTRIBUTES.has(attr.name) || attr.namespaceURI != null) return null;
        if (['fill', 'stroke'].includes(attr.name) && !/^(?:none|currentColor|transparent|#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\))$/i.test(attr.value.trim())) return null;
      }
    }
    root.setAttribute('xmlns', SVG_NS);
    return new XMLSerializer().serializeToString(root);
  } catch {
    return null;
  }
}
