import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import {
  putPosts,
  putTitleEmbedding,
  putArticleEmbedding,
  getPost,
  getPosts,
  hasTitleEmbedding,
  hasArticleEmbedding,
  getPostsTitleSimilar,
  getPostsArticleSimilar,
} from "./post.ts";
import type { Post } from "./types.ts";

let db: Database;

const makePost = (overrides: Partial<Post> = {}): Post => ({
  id: "1",
  title: "Test Post",
  article: null,
  articleSummaryS: null,
  articleSummaryL: null,
  url: "https://example.com",
  byUser: "alice",
  time: "2026-01-01T00:00:00",
  domain: "example.com",
  upvoted: false,
  ...overrides,
});

beforeEach(() => {
  db = new Database(":memory:");
  initDb(db);
});

describe("post", () => {
  describe("putPosts / getPost", () => {
    it("inserts and retrieves a post", () => {
      putPosts(db, [makePost()]);
      const got = getPost(db, "1");
      expect(got).not.toBeNull();
      expect(got!.id).toBe("1");
      expect(got!.title).toBe("Test Post");
      expect(got!.upvoted).toBe(false);
    });

    it("upserts without duplicating", () => {
      putPosts(db, [makePost()]);
      putPosts(db, [makePost({ title: "Updated" })]);
      expect(getPost(db, "1")!.title).toBe("Updated");
    });

    it("returns null for missing post", () => {
      expect(getPost(db, "nonexistent")).toBeNull();
    });

    it("handles multiple posts in one call", () => {
      putPosts(db, [makePost({ id: "1" }), makePost({ id: "2", title: "Second" })]);
      expect(getPost(db, "2")!.title).toBe("Second");
    });
  });

  describe("getPosts", () => {
    it("returns multiple posts by id", () => {
      putPosts(db, [makePost({ id: "1" }), makePost({ id: "2" })]);
      expect(getPosts(db, ["1", "2"])).toHaveLength(2);
    });

    it("returns empty array for empty ids", () => {
      expect(getPosts(db, [])).toHaveLength(0);
    });

    it("skips missing ids", () => {
      putPosts(db, [makePost({ id: "1" })]);
      expect(getPosts(db, ["1", "999"])).toHaveLength(1);
    });
  });

  describe("putTitleEmbedding / hasTitleEmbedding", () => {
    it("stores and detects a title embedding", () => {
      putPosts(db, [makePost()]);
      expect(hasTitleEmbedding(db, "1")).toBe(false);
      putTitleEmbedding(db, "1", new Float32Array(384).fill(0.1));
      expect(hasTitleEmbedding(db, "1")).toBe(true);
    });

    it("overwrites an existing title embedding", () => {
      putPosts(db, [makePost()]);
      putTitleEmbedding(db, "1", new Float32Array(384).fill(0.1));
      putTitleEmbedding(db, "1", new Float32Array(384).fill(0.9));
      expect(hasTitleEmbedding(db, "1")).toBe(true);
    });
  });

  describe("putArticleEmbedding / hasArticleEmbedding", () => {
    it("stores and detects an article embedding", () => {
      putPosts(db, [makePost()]);
      expect(hasArticleEmbedding(db, "1")).toBe(false);
      putArticleEmbedding(db, "1", new Float32Array(384).fill(0.5));
      expect(hasArticleEmbedding(db, "1")).toBe(true);
    });
  });

  describe("getPostsTitleSimilar", () => {
    it("returns only upvoted posts sorted by similarity", () => {
      putPosts(db, [
        makePost({ id: "u1", upvoted: true }),
        makePost({ id: "u2", upvoted: false }),
      ]);
      putTitleEmbedding(db, "u1", new Float32Array(384).fill(0.1));
      putTitleEmbedding(db, "u2", new Float32Array(384).fill(0.9));

      const results = getPostsTitleSimilar(db, new Float32Array(384).fill(0.1), 5);
      expect(results.every((r) => r.post.upvoted)).toBe(true);
      expect(results[0]!.post.id).toBe("u1");
      expect(results[0]!.distance).toBeCloseTo(0, 1);
    });

    it("returns empty array when no embeddings exist", () => {
      putPosts(db, [makePost({ upvoted: true })]);
      expect(getPostsTitleSimilar(db, new Float32Array(384).fill(0.1), 5)).toHaveLength(0);
    });
  });

  describe("getPostsArticleSimilar", () => {
    it("returns upvoted posts sorted by article similarity", () => {
      putPosts(db, [makePost({ id: "a1", upvoted: true })]);
      const emb = new Float32Array(384).fill(0.5);
      putArticleEmbedding(db, "a1", emb);

      const results = getPostsArticleSimilar(db, emb, 5);
      expect(results).toHaveLength(1);
      expect(results[0]!.post.id).toBe("a1");
    });
  });
});
