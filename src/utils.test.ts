import { describe, it, expect } from "bun:test";
import { fetchSafe } from "./utils.ts";

describe("utils", () => {
  describe("fetchSafe", () => {
    it("returns plaintext from a simple article page", async () => {
      const text = await fetchSafe("https://en.wikipedia.org/wiki/Hacker_News");
      expect(text).not.toBeNull();
      expect(text!.length).toBeGreaterThan(100);
      expect(text).toContain("Hacker News");
    });

    it("returns null for an unreachable URL without throwing", async () => {
      const text = await fetchSafe("https://localhost:19999/nonexistent");
      expect(text).toBeNull();
    });

    it("falls back to Jina for pages that block plain fetch", async () => {
      // Medium blocks scrapers without JS; Jina handles it via headless Chrome
      const text = await fetchSafe("https://medium.com/topic/programming");
      expect(text).not.toBeNull();
      expect(text!.length).toBeGreaterThan(100);
    });
  });
});
