import { describe, expect, it } from "vitest";
import { sessionTitleForDisplay } from "../src/lib/session-title-display";

describe("displaying legacy visual-result titles", () => {
  it("repairs only the native 30-character image-id prefix", () => {
    const title = '{"image_id":"sha256:87841d02da';
    expect(title).toHaveLength(30);
    expect(sessionTitleForDisplay(title, "zh", "新建对话")).toBe("图片识别");
    expect(sessionTitleForDisplay(title, "en", "New chat")).toBe("Image recognition");
  });

  it("also repairs the exact native batch-title truncation", () => {
    const title = '{"results":[{"image_id":"sha25';
    expect(title).toHaveLength(30);
    expect(sessionTitleForDisplay(title, "zh", "新建对话")).toBe("图片识别");
  });

  it.each([
    "SVG动画：鹅鹅骑自行车",
    "这是一个很长的手工名称，用于检查完整标题仍然可通过提示查看",
    '检查 {"image_id":"sha256:87841d02da 的字段',
    '{"image_id":"sha256:87841d02d',
    '{"image_id":"sha256:87841D02DA',
    '{"image_id":"sha256:87841d02daz',
    '{"image_id":"sha256:87841d02da"}',
    '{"results":[{"image_id":"sha256:',
    "image_id sha256:87841d02da",
    "",
  ])("leaves other titles untouched: %s", (title) => {
    expect(sessionTitleForDisplay(title, "zh", "新建对话")).toBe(title);
  });

  it("keeps the official untitled-session fallback", () => {
    expect(sessionTitleForDisplay(undefined, "zh", "新建对话")).toBe("新建对话");
    expect(sessionTitleForDisplay(undefined, "en", "New chat")).toBe("New chat");
  });
});
