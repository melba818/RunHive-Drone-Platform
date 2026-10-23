/** User-facing model failures. Provider diagnostics stay in the original Trace fields. */
export function modelErrorText(code?: string, message?: string): string {
  const kind = (code ?? "").toLowerCase();
  const detail = (message ?? "").toLowerCase();
  if (/rate.?limit|too_many_requests/.test(kind) || /\b429\b|rate.?limit/.test(detail)) {
    return "请求过于频繁，请稍后重试。";
  }
  if (/authentication|invalid_api_key|credential|permission|unauthorized|forbidden/.test(kind)) {
    return "连接验证失败，请检查模型配置。";
  }
  if (/context.?length|context.?window|token.?limit/.test(kind) || /上下文.{0,12}(?:超出|过长|超过)|context.{0,30}(?:exceed|limit|too long)/.test(detail)) {
    return "请求内容超出处理范围，请减少内容后重试。";
  }
  if (/image.?limit|too_many_images/.test(kind) || /图片数量|仅支持\s*\d+\s*张|too many images|number of images/.test(detail)) {
    return "图片数量超出处理范围，请分批提交。";
  }
  if (/invalid.?result|invalid.?response/.test(kind) || /返回结果.{0,8}(?:无效|校验失败)|框坐标.{0,8}(?:无效|校验失败)/.test(detail)) {
    return "处理结果无效，请重新提交。";
  }
  if (/timeout|connection|unavailable|service_error/.test(kind)) {
    return "服务暂不可用，请稍后重试。";
  }
  return "请求处理失败，请稍后重试。";
}

/** Only legacy assistant error banners, never normal prose or code containing an error example. */
export function legacyModelErrorText(text: string): string | null {
  if (!/^\s*\[(?:错误|error)\]\s*[:：]?\s*(?:模型请求错误|model request error)\s*[:：]/i.test(text)) return null;
  if (!/(?:\(\s*platform_model_error\s*\)|platform_model_error)\s*$/i.test(text)) return null;
  return modelErrorText(undefined, text);
}
