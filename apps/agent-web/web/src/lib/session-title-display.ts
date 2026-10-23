import type { Locale } from "../state/locale";

/**
 * The native title generator used to receive a visual result instead of a title. Its
 * 30-character sanitizer persisted these exact prefixes. Repair their display only:
 * manual titles, transcripts and stored metadata remain untouched.
 */
const LEGACY_SINGLE_IMAGE_TITLE = /^\{"image_id":"sha256:[0-9a-f]{10}$/;
const LEGACY_BATCH_IMAGE_TITLE = '{"results":[{"image_id":"sha25';

export function sessionTitleForDisplay(
  title: string | undefined,
  locale: Locale,
  defaultTitle: string,
): string {
  if (title === undefined) return defaultTitle;
  if (LEGACY_SINGLE_IMAGE_TITLE.test(title) || title === LEGACY_BATCH_IMAGE_TITLE) {
    return locale === "zh" ? "图片识别" : "Image recognition";
  }
  return title;
}
