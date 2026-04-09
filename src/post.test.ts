import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import {
  putPosts,
  getPost,
  getPosts,
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


});
