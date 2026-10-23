import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { bboxDrawing, bboxImagePath, drawBboxImage, parseBboxResult } from "../src/features/chat/bbox-result";
import { BboxImageOverlay } from "../src/features/chat/bbox-image-overlay";

const valid = {
  image_id: `sha256:${"a".repeat(64)}`,
  image_size: { width: 1920, height: 1080 },
  bbox_format: "xyxy",
  coordinate_system: "pixel",
  detections: [{ label: "疑似游泳人员", bbox: [585, 529, 630, 557] }],
};

describe("managed bbox photo protocol", () => {
  it("recognizes the existing stored result and keeps the original pixels", () => {
    expect(parseBboxResult(JSON.stringify(valid))).toEqual(valid);
  });
  it("renders an empty detection result as a photo without inventing boxes", () => {
    expect(parseBboxResult(JSON.stringify({ ...valid, detections: [] }))?.detections).toEqual([]);
  });
  it.each([
    "普通回复", '{"coordinate_system":"pixel","detections":[]}',
    `\`\`\`json\n${JSON.stringify(valid)}\n\`\`\``,
  ])("leaves unrelated or incomplete replies with the normal renderer: %s", (text) => {
    expect(parseBboxResult(text)).toBeNull();
  });
  it.each([
    { coordinate_system: "normalized_1000" }, { bbox_format: "xywh" },
    { image_id: "image_url" }, { image_id: `sha256:${"a".repeat(63)}` },
    { image_size: { width: 0, height: 1080 } },
    { image_size: { width: 1920.5, height: 1080 } },
    { image_size: { width: 1920, height: 1080, confidence: 1 } },
    { confidence: 0.9 },
  ])("rejects guessed units, unbound images, invalid metadata, and unexpected fields", (change) => {
    expect(parseBboxResult(JSON.stringify({ ...valid, ...change }))).toBeNull();
  });
  it.each([
    [-1, 529, 630, 557], [585, -1, 630, 557], [585, 529, 1921, 557],
    [585, 529, 630, 1081], [630, 529, 585, 557], [585, 529, 585, 557],
    [585, 557, 630, 529], [585, 529, 630, 529], [585.5, 529, 630, 557],
    [true, 529, 630, 557], [585, 529, 630], [585, 529, 630, 557, 1],
    [585, 529, null, 557],
  ])("rejects a box that cannot be drawn on the original source", (...bbox) => {
    expect(parseBboxResult(JSON.stringify({ ...valid, detections: [{ label: "人", bbox }] }))).toBeNull();
  });
  it("does not reinterpret model confidence as a valid result field", () => {
    expect(parseBboxResult(JSON.stringify({ ...valid, detections: [{ ...valid.detections[0], confidence: 0.9 }] }))).toBeNull();
  });
  it("accepts boxes touching the raster edges without clipping coordinates", () => {
    const input = { ...valid, detections: [{ label: "目标", bbox: [0, 0, 1920, 1080] }] };
    expect(parseBboxResult(JSON.stringify(input))).toEqual(input);
  });
  it("requests only the exact image hash in the selected session", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const sessionId = "session-2026-10-08-10-19-29-9f518278";
    expect(bboxImagePath(sessionId, result)).toBe(`/api/sessions/${sessionId}/visual-images/${"a".repeat(64)}`);
    expect(bboxImagePath("../other-session", result)).toBeNull();
    expect(bboxImagePath(sessionId, { ...result, image_id: "https://other/image.png" })).toBeNull();
  });
  it.each(["\n", "\r", "\r\n"])("rejects an image identifier with trailing line breaks", (suffix) => {
    expect(parseBboxResult(JSON.stringify({ ...valid, image_id: valid.image_id + suffix }))).toBeNull();
  });
  it.each(["\n", "\r", "\r\n"])("never builds a URL with trailing line breaks in the session or hash", (suffix) => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const sessionId = "session-2026-10-08-10-19-29-9f518278";
    expect(bboxImagePath(sessionId + suffix, result)).toBeNull();
    expect(bboxImagePath(sessionId, { ...result, image_id: result.image_id + suffix })).toBeNull();
  });
  it("keeps the displayed box and label inside the source raster at an edge", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const drawing = bboxDrawing(result, { label: "目标", bbox: [1900, 0, 1920, 20] }, 0);
    expect([drawing.x, drawing.y, drawing.width, drawing.height]).toEqual([1900, 0, 20, 20]);
    expect(drawing.labelX).toBeGreaterThanOrEqual(0);
    expect(drawing.labelY).toBeGreaterThanOrEqual(0);
    expect(drawing.labelX + drawing.labelWidth).toBeLessThanOrEqual(1920);
    expect(drawing.labelY + drawing.labelHeight).toBeLessThanOrEqual(1080);
  });
  it("exports the original raster size and the exact validated bbox, without changing the image", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const source = {} as CanvasImageSource;
    const canvas = { drawImage: vi.fn(), strokeRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn() };
    drawBboxImage(canvas as unknown as CanvasRenderingContext2D, source, result);
    expect(canvas.drawImage).toHaveBeenCalledExactlyOnceWith(source, 0, 0, 1920, 1080);
    expect(canvas.strokeRect).toHaveBeenCalledExactlyOnceWith(585, 529, 45, 28);
    expect(canvas.fillText.mock.calls[0]?.[0]).toBe("1 疑似游泳人员");
    expect(result).toEqual(valid);
  });
});

describe("compact labels on the unchanged original-pixel boxes", () => {
  it("leaves the small real target box intact and separates the compact label from it", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const drawing = bboxDrawing(result, result.detections[0]!, 0);
    expect([drawing.x, drawing.y, drawing.width, drawing.height]).toEqual([585, 529, 45, 28]);
    expect(drawing.fontSize).toBe(32);
    expect(drawing.labelWidth).toBeLessThan(300);
    expect(drawing.labelHeight).toBeLessThan(60);
    expect(drawing.labelY + drawing.labelHeight).toBeLessThanOrEqual(drawing.y - 4);
  });

  it.each([
    [1900, 0, 1920, 20], [0, 0, 20, 20], [0, 1060, 20, 1080],
    [1900, 1060, 1920, 1080], [0, 0, 20, 1080], [1900, 0, 1920, 1080],
  ])("fits edge labels outside the target without moving its rectangle", (...bbox) => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const detection = { label: "目标", bbox: bbox as [number, number, number, number] };
    const drawing = bboxDrawing(result, detection, 0);
    expect([drawing.x, drawing.y, drawing.width, drawing.height]).toEqual([bbox[0], bbox[1], bbox[2]! - bbox[0]!, bbox[3]! - bbox[1]!]);
    expect(drawing.labelX).toBeGreaterThanOrEqual(0);
    expect(drawing.labelY).toBeGreaterThanOrEqual(0);
    expect(drawing.labelX + drawing.labelWidth).toBeLessThanOrEqual(1920);
    expect(drawing.labelY + drawing.labelHeight).toBeLessThanOrEqual(1080);
    const overlaps = drawing.labelX < bbox[2]! && drawing.labelX + drawing.labelWidth > bbox[0]! && drawing.labelY < bbox[3]! && drawing.labelY + drawing.labelHeight > bbox[1]!;
    expect(overlaps).toBe(false);
  });

  it("truncates long Unicode labels without squeezing the font or altering the source", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const detection = { label: "🏊游泳人员".repeat(30), bbox: [585, 529, 630, 557] as [number, number, number, number] };
    const before = structuredClone(detection);
    const drawing = bboxDrawing(result, detection, 0);
    expect(drawing.label).toContain("…");
    expect(drawing.label).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    expect(drawing.labelWidth).toBeLessThanOrEqual(320);
    expect(detection).toEqual(before);
  });

  it("uses the same text baseline in the SVG preview and the full-resolution Canvas export", () => {
    const result = parseBboxResult(JSON.stringify(valid))!;
    const drawing = bboxDrawing(result, result.detections[0]!, 0);
    const canvas = { drawImage: vi.fn(), strokeRect: vi.fn(), fillRect: vi.fn(), fillText: vi.fn(), save: vi.fn(), beginPath: vi.fn(), rect: vi.fn(), clip: vi.fn(), restore: vi.fn(), textBaseline: "top" };
    drawBboxImage(canvas as unknown as CanvasRenderingContext2D, {} as CanvasImageSource, result);
    const svg = renderToStaticMarkup(createElement(BboxImageOverlay, { result }));
    expect(svg).toContain(`y="${drawing.labelBaseline}"`);
    expect(svg).toContain('clip-path="url(#');
    expect(canvas.textBaseline).toBe("alphabetic");
    expect(canvas.fillText).toHaveBeenCalledExactlyOnceWith(drawing.label, drawing.labelX + drawing.padding, drawing.labelBaseline);
    expect(canvas.clip).toHaveBeenCalledOnce();
    expect(canvas.strokeRect).toHaveBeenCalledExactlyOnceWith(585, 529, 45, 28);
  });

  it("keeps a complete-image rectangle visible when no outside label space exists", () => {
    const result = parseBboxResult(JSON.stringify({ ...valid, detections: [{ label: "全图", bbox: [0, 0, 1920, 1080] }] }))!;
    const drawing = bboxDrawing(result, result.detections[0]!, 0);
    expect([drawing.x, drawing.y, drawing.width, drawing.height]).toEqual([0, 0, 1920, 1080]);
    expect(drawing.labelX + drawing.labelWidth).toBeLessThanOrEqual(1920);
    expect(drawing.labelY + drawing.labelHeight).toBeLessThanOrEqual(1080);
  });

  it("omits an unreadable label on a tiny raster while retaining its valid box and title", () => {
    const result = parseBboxResult(JSON.stringify({ ...valid, image_size: { width: 1, height: 1 }, detections: [{ label: "目标", bbox: [0, 0, 1, 1] }] }))!;
    const drawing = bboxDrawing(result, result.detections[0]!, 0);
    expect(drawing.labelVisible).toBe(false);
    const svg = renderToStaticMarkup(createElement(BboxImageOverlay, { result }));
    expect(svg).toContain('width="1" height="1" fill="none"');
    expect(svg).toContain("目标");
    expect(svg).not.toContain("<text");
  });
});
