import { describe, it, expect } from "bun:test";
import { embed } from "./embedding.ts";

describe("embedding", () => {
  describe("embed", () => {
    it("returns a Float32Array of length 384", async () => {
      const result = await embed("hello world");
      expect(result).toBeInstanceOf(Float32Array);
      expect(result.length).toBe(384);
    });

    it("returns a unit vector (normalized)", async () => {
      const result = await embed("test sentence");
      const norm = Math.sqrt(result.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    });

    it("produces different embeddings for different inputs", async () => {
      const a = await embed("machine learning");
      const b = await embed("cooking recipes");
      // Cosine similarity between unrelated topics should be well below 1
      const dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
      expect(dot).toBeLessThan(0.9);
    });

    it("produces similar embeddings for similar inputs", async () => {
      const a = await embed("The cat sat on the mat");
      const b = await embed("A cat was sitting on a mat");
      const dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
      expect(dot).toBeGreaterThan(0.9);
    });

    it("produces distant embeddings for unrelated inputs", async () => {
      const a = await embed("The cat sat on the mat");
      const b = await embed("Stock market crashes amid inflation fears");
      const dot = a.reduce((sum, v, i) => sum + v * b[i]!, 0);
      expect(dot).toBeLessThan(0.1);
    });

    it("handles long text without throwing (truncates to 512 tokens)", async () => {
      const longText = "word ".repeat(1000);
      const result = await embed(longText);
      expect(result.length).toBe(384);
    });
  });
});
