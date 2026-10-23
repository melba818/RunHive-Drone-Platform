import { describe, expect, it } from "vitest";
import { legacyModelErrorText, modelErrorText } from "../src/lib/model-error";

describe("formal model failure wording", () => {
  it.each([
    ["rate_limit", "", "请求过于频繁，请稍后重试。"],
    ["authentication_failed", "secret provider credential", "连接验证失败，请检查模型配置。"],
    ["context_length_exceeded", "raw context payload", "请求内容超出处理范围，请减少内容后重试。"],
    ["too_many_images", "", "图片数量超出处理范围，请分批提交。"],
    ["invalid_response", "", "处理结果无效，请重新提交。"],
    ["timeout", "raw host path", "服务暂不可用，请稍后重试。"],
    ["platform_model_error", "400 internal reason", "请求处理失败，请稍后重试。"],
    [undefined, undefined, "请求处理失败，请稍后重试。"],
  ])("uses stable public wording for %s", (code, detail, expected) => {
    expect(modelErrorText(code, detail)).toBe(expected);
  });
  it("formats saved model errors without status codes or internal diagnostic suffixes", () => {
    expect(legacyModelErrorText("[错误]: 模型请求错误: 400 当前已加载的千问模型一次仅支持 1 张不同图片。 (platform_model_error)"))
      .toBe("图片数量超出处理范围，请分批提交。");
  });
  it.each([
    "错误示例：[错误]: 模型请求错误 (platform_model_error)",
    "```text\n[错误]: 模型请求错误 (platform_model_error)\n```",
    "[错误]普通用户文字",
    "正确返回了图片",
  ])("leaves ordinary assistant text intact", (text) => expect(legacyModelErrorText(text)).toBeNull());
});
