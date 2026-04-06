import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import { putPosts } from "./post.ts";
import { putComments, getComments } from "./comments.ts";
import type { Comment } from "./types.ts";

let db: Database;

const makeComment = (overrides: Partial<Comment> = {}): Comment => ({
  id: "c1",
  postId: "p1",
  byUser: "alice",
  text: "Great post!",
  ...overrides,
});

beforeEach(() => {
  db = new Database(":memory:");
  initDb(db);
  // comments has a FK to posts, so insert a parent post first
  putPosts(db, [
    {
      id: "p1",
      title: "Post One",
      article: null,
      articleSummaryS: null,
      articleSummaryL: null,
      url: "https://example.com/1",
      byUser: "bob",
      time: "2026-01-01T00:00:00",
      domain: "example.com",
      upvoted: false,
    },
    {
      id: "p2",
      title: "Post Two",
      article: null,
      articleSummaryS: null,
      articleSummaryL: null,
      url: "https://example.com/2",
      byUser: "bob",
      time: "2026-01-01T00:00:00",
      domain: "example.com",
      upvoted: false,
    },
  ]);
});

describe("comments", () => {
  describe("putComments", () => {
    it("inserts comments and retrieves them by postId", () => {
      putComments(db, [makeComment()]);
      const got = getComments(db, "p1");
      expect(got).toHaveLength(1);
      expect(got[0]!.id).toBe("c1");
      expect(got[0]!.byUser).toBe("alice");
      expect(got[0]!.text).toBe("Great post!");
    });

    it("ignores duplicate comment ids (INSERT OR IGNORE)", () => {
      putComments(db, [makeComment()]);
      putComments(db, [makeComment({ text: "Changed" })]);
      const got = getComments(db, "p1");
      expect(got).toHaveLength(1);
      expect(got[0]!.text).toBe("Great post!");
    });

    it("inserts multiple comments in one call", () => {
      putComments(db, [
        makeComment({ id: "c1" }),
        makeComment({ id: "c2", text: "Me too" }),
      ]);
      expect(getComments(db, "p1")).toHaveLength(2);
    });

    it("is a no-op for empty array", () => {
      putComments(db, []);
      expect(getComments(db, "p1")).toHaveLength(0);
    });
  });

  describe("getComments", () => {
    it("returns only comments for the requested postId", () => {
      putComments(db, [
        makeComment({ id: "c1", postId: "p1" }),
        makeComment({ id: "c2", postId: "p2" }),
      ]);
      expect(getComments(db, "p1")).toHaveLength(1);
      expect(getComments(db, "p2")).toHaveLength(1);
    });

    it("returns empty array when no comments exist", () => {
      expect(getComments(db, "p1")).toHaveLength(0);
    });
  });
});
