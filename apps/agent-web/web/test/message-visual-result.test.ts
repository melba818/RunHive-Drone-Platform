/** Integration of legacy/multi-image messages and formal error notices into the real dispatch. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MessageItem } from "../src/features/chat/message-item";
import type { StreamRenderContext } from "../src/features/chat/message-stream";
import type { ChatItem } from "../src/lib/omni/stream-model";
import type { BboxResult } from "../src/features/chat/bbox-result";

const captured = vi.hoisted(() => [] as { result: BboxResult; sessionId: string }[]);
vi.mock("../src/features/chat/bbox-image-result", () => ({
  BboxImageResult: (props: { result: BboxResult; sessionId: string }) => {
    captured.push(props);
    return createElement("div", { "data-visual-image": props.result.image_id });
  },
}));

const SID = "session-2026-10-08-10-19-29-9f518278";
const CHILD = "session-2026-10-09-13-30-00-ffffffff";
const first = {
  image_id: `sha256:${"a".repeat(64)}`,
  image_size: { width: 1920, height: 1080 }, bbox_format: "xyxy", coordinate_system: "pixel",
  detections: [{ label: "疑似游泳人员", bbox: [585, 529, 630, 557] }],
};
const second = { ...first, image_id: `sha256:${"b".repeat(64)}` };
const ctx: StreamRenderContext = {
  visualSessionId: SID, origin: [], taskRunning: false,
  pendingApprovals: new Map(), onApprove: async () => {},
};
const render = (item: ChatItem, context = ctx) => renderToStaticMarkup(createElement(MessageItem, { item, ctx: context }));
const reply = (text: string, streaming = false): ChatItem => ({ kind: "assistant_text", id: 1, text, streaming });

beforeEach(() => { captured.length = 0; });

describe("vision result dispatch", () => {
  it("turns an existing V16 JSON message into its own session's photo result", () => {
    render(reply(JSON.stringify(first)));
    expect(captured).toEqual([{ result: first, sessionId: SID }]);
  });
  it("renders ordered batches with each image's distinct identity", () => {
    const html = render(reply(JSON.stringify({ results: [first, second] })));
    expect(captured.map((value) => value.result.image_id)).toEqual([first.image_id, second.image_id]);
    expect(captured.every((value) => value.sessionId === SID)).toBe(true);
    expect(html).toContain("图片 1");
    expect(html).toContain("图片 2");
  });
  it("keeps two submitted copies as two result cards", () => {
    render(reply(JSON.stringify({ results: [first, first] })));
    expect(captured).toHaveLength(2);
  });
  it("uses the last origin session for nested child messages", () => {
    render(reply(JSON.stringify(first)), { ...ctx, origin: [SID, CHILD] });
    expect(captured[0]?.sessionId).toBe(CHILD);
  });
  it("keeps a streaming reply on the official text renderer until complete", () => {
    render(reply(JSON.stringify(first), true));
    expect(captured).toHaveLength(0);
  });
  it("keeps ordinary prose and malformed JSON on the official renderer", () => {
    expect(render(reply("普通回复内容"))).toContain("普通回复内容");
    render(reply(JSON.stringify({ ...first, coordinate_system: "normalized_1000" })));
    expect(captured).toHaveLength(0);
  });
});

describe("formal model error display", () => {
  it("shows a short notice for fatal provider diagnostics without mutating the trace item", () => {
    const item: ChatItem = { kind: "llm_error", id: 1, errorCode: "platform_model_error", errorMessage: "400 internal diagnostic secret" };
    const html = render(item);
    expect(html).toContain("请求处理失败，请稍后重试。");
    expect(html).not.toContain("400");
    expect(html).not.toContain("platform_model_error");
    expect(item.errorMessage).toBe("400 internal diagnostic secret");
  });
  it("formats a legacy whole error banner without replacing ordinary discussions", () => {
    const banner = "[错误]: 模型请求错误: 400 模型上下文检查失败，请重试。(platform_model_error)";
    const html = render(reply(banner));
    expect(html).toContain("请求处理失败，请稍后重试。");
    expect(html).not.toContain("400");
    expect(html).not.toContain("platform_model_error");
    expect(render(reply(`说明：${banner}`))).toContain("platform_model_error");
  });
  it("keeps an unfinished legacy banner with the normal streaming text", () => {
    const html = render(reply("[错误]: 模型请求错误 (platform_model_error)", true));
    expect(html).toContain('data-state="streaming"');
    expect(html).not.toContain("请求处理失败，请稍后重试。");
  });
  it("formats an exhausted retry without raw provider status or diagnostics", () => {
    const html = render({ kind: "reconnect", id: 1, status: "retryable", attempt: 3, retrying: false, gaveUp: true, errorCode: "timeout", errorMessage: "400 platform_model_error secret" });
    expect(html).toContain("服务暂不可用，请稍后重试。");
    expect(html).not.toContain("400");
    expect(html).not.toContain("platform_model_error");
  });
  it("preserves the official retry status while excluding raw diagnostics", () => {
    const html = render({ kind: "reconnect", id: 1, status: "retryable", attempt: 3, retrying: false, errorCode: "platform_model_error", errorMessage: "400 secret" });
    expect(html).not.toContain("400");
    expect(html).not.toContain("platform_model_error");
    expect(html).not.toContain("secret");
  });
});
