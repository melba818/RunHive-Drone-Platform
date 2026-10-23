import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConversationOutline, OutlineMenuButton } from "../src/features/chat/conversation-outline";

const entries = Array.from({ length: 7 }, (_, anchorId) => ({
  anchorId,
  question: `问题 ${anchorId + 1}`,
  answer: `回答 ${anchorId + 1}`,
}));
const scrollRef = { current: null };
const rail = (shown = true) => renderToStaticMarkup(createElement(ConversationOutline, {
  entries, version: 1, scrollRef, running: false, fit: { shown, height: 500 },
}));

describe("Runhive conversation outline placement", () => {
  it("places turn navigation on the main stream's right gutter, clear of sidebar controls", () => {
    const html = rail();
    expect(html).toMatch(/^<nav[^>]*class="[^"]*absolute inset-y-0 right-\[20px\] /);
    expect(html).not.toContain("left-0");
    expect(html.match(/data-outline-tick=/g)).toHaveLength(entries.length);
    expect(html).toContain("justify-end pr-2.5");
    expect(html).toContain("pointer-events-none");
    expect(html).toContain("pointer-events-auto");
  });

  it("preserves the toolbar fallback when a dock or narrow viewport takes the gutter", () => {
    expect(rail(false)).toBe("");
    const html = renderToStaticMarkup(createElement(OutlineMenuButton, {
      entries, scrollRef, running: false,
    }));
    expect(html).toContain("<button");
    expect(html).toContain("aria-label=");
  });

  it("opens hover previews toward the conversation and keeps jump targets in the stream", () => {
    const source = readFileSync(new URL("../src/features/chat/conversation-outline.tsx", import.meta.url), "utf8");
    expect(source).toMatch(/data-outline-card[\s\S]*?className="[^"]*absolute right-10 w-80/);
    expect(source).not.toMatch(/data-outline-card[\s\S]*?className="[^"]*left-10/);
    expect(source).toContain("jumpToAnchor(scrollRef.current, entry.anchorId)");
    expect(source).toContain('container?.querySelector<HTMLElement>(`[data-outline-anchor="${id}"]`)');
  });
});
