/** Read a whole image selection atomically, preserving pick order even when reads finish out of order. */
export async function readImagesInOrder<T>(
  files: readonly T[],
  read: (file: T) => Promise<string | null>,
): Promise<{ images: string[]; failed: number }> {
  const urls = await Promise.all(files.map(async (file) => {
    try {
      const value = await read(file);
      return typeof value === "string" && value.length > 0 ? value : null;
    } catch {
      // A synchronous FileReader failure or rejected read still settles this batch and the intake queue.
      return null;
    }
  }));
  return {
    images: urls.flatMap((value) => value === null ? [] : [value]),
    failed: urls.filter((value) => value === null).length,
  };
}
