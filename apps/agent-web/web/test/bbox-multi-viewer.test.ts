import { describe, expect, it } from "vitest";
import { parseBboxResult, parseBboxResults } from "../src/features/chat/bbox-result";
import { clampBboxZoom, fitBboxZoom, zoomedBboxSize } from "../src/features/chat/bbox-viewer-geometry";

const first = {
  image_id: `sha256:${"a".repeat(64)}`,
  image_size: { width: 1920, height: 1080 },
  bbox_format: "xyxy", coordinate_system: "pixel",
  detections: [{ label: "疑似游泳人员", bbox: [585, 529, 630, 557] }],
};
const second = {
  ...first, image_id: `sha256:${"b".repeat(64)}`,
  image_size: { width: 320, height: 240 },
  detections: [{ label: "人员", bbox: [10, 20, 30, 40] }],
};

describe("ordered multi-image display", () => {
  it("keeps existing singleton replies without changing the old parser", () => {
    expect(parseBboxResults(JSON.stringify(first))).toEqual([first]);
    expect(parseBboxResult(JSON.stringify(first))).toEqual(first);
  });
  it("keeps each uploaded image's identity, dimensions, and coordinates in order", () => {
    expect(parseBboxResults(JSON.stringify({ results: [first, second] }))).toEqual([first, second]);
    expect(parseBboxResults(JSON.stringify({ results: [second, first] }))).toEqual([second, first]);
  });
  it("preserves repeated uploads rather than removing repeated hashes", () => {
    expect(parseBboxResults(JSON.stringify({ results: [first, first] }))).toEqual([first, first]);
  });
  it("keeps an empty detection result for the corresponding image", () => {
    const empty = { ...second, detections: [] };
    expect(parseBboxResults(JSON.stringify({ results: [first, empty] }))).toEqual([first, empty]);
  });
  it.each([
    { results: [] }, { results: null }, { results: [first], extra: true },
    { results: Array.from({ length: 17 }, () => first) },
    { images: [first, second] },
    { results: [first, { ...second, coordinate_system: "normalized_1000" }] },
    { results: [first, { ...second, detections: [{ label: "人", bbox: [10, 20, 400, 40] }] }] },
    { results: [first, { ...second, image_id: second.image_id + "\n" }] },
  ])("rejects malformed batches rather than silently rendering a partial result", (value) => {
    expect(parseBboxResults(JSON.stringify(value))).toBeNull();
  });
  it("does not turn ordinary prose or unfinished streaming JSON into an image batch", () => {
    expect(parseBboxResults("普通回复")).toBeNull();
    expect(parseBboxResults('{"results":[')).toBeNull();
  });
});

describe("photo viewer zoom", () => {
  it("starts at a fit scale that shows the entire original image", () => {
    expect(fitBboxZoom(1920, 1080, 960, 800)).toBe(0.5);
    expect(fitBboxZoom(1920, 1080, 1500, 540)).toBe(0.5);
    expect(fitBboxZoom(320, 240, 960, 800)).toBe(1);
  });
  it("retains true raster dimensions at original size and scales the whole overlay layer", () => {
    expect(zoomedBboxSize(1920, 1080, 1)).toEqual({ width: 1920, height: 1080 });
    expect(zoomedBboxSize(1920, 1080, 2)).toEqual({ width: 3840, height: 2160 });
    expect(zoomedBboxSize(1920, 1080, 0.5)).toEqual({ width: 960, height: 540 });
  });
  it("bounds control zoom and safely handles unavailable viewport measurements", () => {
    expect(clampBboxZoom(-1)).toBe(0.01);
    expect(clampBboxZoom(20)).toBe(8);
    expect(clampBboxZoom(NaN)).toBe(1);
    expect(fitBboxZoom(1920, 1080, 0, 800)).toBe(1);
  });
});
