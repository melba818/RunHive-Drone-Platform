/** The managed vision result protocol. Ordinary JSON and Markdown keep their normal renderer. */
export interface BboxDetection {
  label: string;
  bbox: [number, number, number, number];
}

export interface BboxResult {
  image_id: string;
  image_size: { width: number; height: number };
  bbox_format: "xyxy";
  coordinate_system: "pixel";
  detections: BboxDetection[];
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function keys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value);
}

/** Accept only canonical, original-pixel results, never guess a coordinate system. */
export function parseBboxResult(text: string): BboxResult | null {
  if (text.length > 256 * 1024) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !object(value) ||
    !keys(value, ["image_id", "image_size", "bbox_format", "coordinate_system", "detections"]) ||
    typeof value.image_id !== "string" ||
    !/^sha256:[a-f0-9]{64}(?![\s\S])/.test(value.image_id) ||
    value.bbox_format !== "xyxy" ||
    value.coordinate_system !== "pixel" ||
    !object(value.image_size) ||
    !keys(value.image_size, ["width", "height"]) ||
    !Array.isArray(value.detections) ||
    value.detections.length > 1000
  ) return null;
  const { width, height } = value.image_size;
  if (
    typeof width !== "number" || !Number.isSafeInteger(width) || width <= 0 ||
    typeof height !== "number" || !Number.isSafeInteger(height) || height <= 0 ||
    width * height > 90_000_000
  ) return null;
  const detections: BboxDetection[] = [];
  for (const detection of value.detections) {
    if (
      !object(detection) || !keys(detection, ["label", "bbox"]) ||
      typeof detection.label !== "string" || !detection.label.trim() ||
      detection.label.length > 1024 || !Array.isArray(detection.bbox) || detection.bbox.length !== 4 ||
      detection.bbox.some((part: unknown) => typeof part !== "number" || !Number.isSafeInteger(part))
    ) return null;
    const [x1, y1, x2, y2] = detection.bbox as [number, number, number, number];
    if (!(0 <= x1 && x1 < x2 && x2 <= width && 0 <= y1 && y1 < y2 && y2 <= height)) return null;
    detections.push({ label: detection.label.trim(), bbox: [x1, y1, x2, y2] });
  }
  return {
    image_id: value.image_id,
    image_size: { width, height },
    bbox_format: "xyxy",
    coordinate_system: "pixel",
    detections,
  };
}

/** Keep the legacy single image reply, or accept an explicitly ordered multi-image reply. */
export function parseBboxResults(text: string): BboxResult[] | null {
  const single = parseBboxResult(text);
  if (single !== null) return [single];
  if (text.length > 1024 * 1024) return null;
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  if (!object(value) || !keys(value, ["results"]) || !Array.isArray(value.results) ||
      value.results.length === 0 || value.results.length > 16) return null;
  const results: BboxResult[] = [];
  for (const entry of value.results) {
    const encoded = JSON.stringify(entry);
    if (typeof encoded !== "string") return null;
    const result = parseBboxResult(encoded);
    if (result === null) return null;
    // Two uploads of the same bytes remain two results, in the original upload order.
    results.push(result);
  }
  return results;
}

/** The server verifies this hash belongs to this authenticated Session; no arbitrary paths or URLs. */
export function bboxImagePath(sessionId: string, result: BboxResult): string | null {
  if (!/^session-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}-[a-f0-9]{8}(?![\s\S])/.test(sessionId)) return null;
  if (!/^sha256:[a-f0-9]{64}(?![\s\S])/.test(result.image_id)) return null;
  return `/api/sessions/${encodeURIComponent(sessionId)}/visual-images/${result.image_id.slice(7)}`;
}

export const BBOX_BLUE = "#1677ff";

function labelTextWidth(value: string, fontSize: number): number {
  return [...value].reduce((sum, char) => sum + (/[^\u0000-\u007f]/.test(char) ? 1 : 0.6), 0) * fontSize;
}

function fitLabel(value: string, availableWidth: number, fontSize: number): string {
  if (labelTextWidth(value, fontSize) <= availableWidth) return value;
  let prefix = "";
  for (const char of value) {
    if (labelTextWidth(`${prefix}${char}…`, fontSize) > availableWidth) break;
    prefix += char;
  }
  return prefix.trimEnd() ? `${prefix.trimEnd()}…` : "";
}

/** Shared label placement for the responsive preview and the original-resolution export. */
export function bboxDrawing(result: BboxResult, detection: BboxDetection, index: number) {
  const { width, height } = result.image_size;
  const fontSize = Math.min(32, Math.max(12, Math.min(width / 60, height / 24)), Math.max(1, (height - 8) / 1.75));
  const padding = Math.max(3, fontSize / 5);
  const lineWidth = Math.max(2, Math.min(8, width / 400));
  const gap = Math.max(4, Math.ceil(lineWidth));
  const availableWidth = Math.min(width, Math.max(96, Math.min(320, width * 0.35)));
  const label = fitLabel(`${index + 1} ${detection.label}`, Math.max(0, availableWidth - padding * 2), fontSize);
  const labelVisible = width >= 32 && height >= 20 && label.length > 0;
  const labelWidth = labelVisible ? Math.min(width, labelTextWidth(label, fontSize) + padding * 2) : 0;
  const labelHeight = labelVisible ? Math.min(height, fontSize * 1.35 + padding * 2) : 0;
  const [x1, y1, x2, y2] = detection.bbox;
  const clampX = (x: number) => Math.max(0, Math.min(x, width - labelWidth));
  const clampY = (y: number) => Math.max(0, Math.min(y, height - labelHeight));
  // Prefer a separate label outside the target; a full-raster target has no outside space.
  const placement = y1 >= labelHeight + gap ? [clampX(x1), y1 - labelHeight - gap]
    : y2 + gap + labelHeight <= height ? [clampX(x1), y2 + gap]
      : x2 + gap + labelWidth <= width ? [x2 + gap, clampY(y1)]
        : x1 >= labelWidth + gap ? [x1 - labelWidth - gap, clampY(y1)]
          : [clampX(x1), clampY(y1 + gap)];
  const [labelX, labelY] = placement as [number, number];
  return {
    x: x1, y: y1, width: x2 - x1, height: y2 - y1,
    lineWidth, gap, label, labelVisible, labelX, labelY, labelWidth, labelHeight, fontSize, padding,
    labelBaseline: labelY + padding + fontSize,
  };
}

/** Draw onto a canvas sized to the verified source raster; downloading never resizes the photo. */
export function drawBboxImage(context: CanvasRenderingContext2D, image: CanvasImageSource, result: BboxResult): void {
  context.drawImage(image, 0, 0, result.image_size.width, result.image_size.height);
  context.textBaseline = "alphabetic";
  result.detections.forEach((detection, index) => {
    const drawing = bboxDrawing(result, detection, index);
    context.strokeStyle = BBOX_BLUE;
    context.lineWidth = drawing.lineWidth;
    context.strokeRect(drawing.x, drawing.y, drawing.width, drawing.height);
    if (drawing.labelVisible) {
      context.fillStyle = BBOX_BLUE;
      context.fillRect(drawing.labelX, drawing.labelY, drawing.labelWidth, drawing.labelHeight);
      context.save();
      context.beginPath();
      context.rect(drawing.labelX + drawing.padding, drawing.labelY,
        Math.max(0, drawing.labelWidth - drawing.padding * 2), drawing.labelHeight);
      context.clip();
      context.fillStyle = "#ffffff";
      context.font = `600 ${drawing.fontSize}px sans-serif`;
      context.fillText(drawing.label, drawing.labelX + drawing.padding, drawing.labelBaseline);
      context.restore();
    }
  });
}
