import { describe, expect, it } from "vitest";
import { readImagesInOrder } from "../src/features/chat/ordered-image-input";

describe("ordered Composer image intake", () => {
  it("stages A and B together in pick order when B finishes before A", async () => {
    const resolvers = new Map<string, (value: string | null) => void>();
    let complete = false;
    const reading = readImagesInOrder(["A", "B"], (file) => new Promise<string | null>((resolve) => { resolvers.set(file, resolve); }));
    void reading.then(() => { complete = true; });
    resolvers.get("B")!("data:image/png;base64,B");
    await Promise.resolve();
    expect(complete).toBe(false);
    resolvers.get("A")!("data:image/png;base64,A");
    expect(await reading).toEqual({ images: ["data:image/png;base64,A", "data:image/png;base64,B"], failed: 0 });
  });
  it("settles rejected and synchronous failed reads without dropping successful images or reordering them", async () => {
    const result = await readImagesInOrder(["A", "B", "C", "D"], (file) => {
      if (file === "B") return Promise.reject(new Error("unreadable"));
      if (file === "D") throw new Error("FileReader failed");
      return Promise.resolve(`data:image/png;base64,${file}`);
    });
    expect(result).toEqual({ images: ["data:image/png;base64,A", "data:image/png;base64,C"], failed: 2 });
  });
  it("keeps repeated selections and reports null reads explicitly", async () => {
    expect(await readImagesInOrder([1, 2, 3], async (file) => file === 3 ? null : "data:image/png;base64,same"))
      .toEqual({ images: ["data:image/png;base64,same", "data:image/png;base64,same"], failed: 1 });
  });
  it("settles an empty image selection", async () => {
    expect(await readImagesInOrder([], async () => null)).toEqual({ images: [], failed: 0 });
  });
});
