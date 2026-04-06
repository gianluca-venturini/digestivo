import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import { cmdGetPostsDay, cmdGetPostsDays, cmdGetUpvotedAll } from "./run.ts";
import { getPosts } from "./post.ts";
import { getPost, putPosts } from "./post.ts";
import type { Post } from "./types.ts";

const makePost = (id: string): Post => ({
  id,
  title: `Post ${id}`,
  article: null,
  url: `https://example.com/${id}`,
  byUser: "alice",
  time: "2026-01-01T00:00:00",
  domain: "example.com",
  upvoted: false,
});

// Mock fetcher returns deterministic fake posts keyed by day+page — no HN network calls
const mockFetcher = async (day: string, page: number): Promise<Post[]> =>
  Array.from({ length: 30 }, (_, i) =>
    makePost(`${day.replace(/-/g, "")}_${page}_${i}`)
  );

let db: Database;

beforeEach(() => {
  db = new Database(":memory:");
  initDb(db);
});

describe("run", () => {
  describe("get-posts-day", () => {
    it("saves posts to the db", async () => {
      await cmdGetPostsDay(db, "2026-01-01", 1, mockFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;
      expect(count).toBe(30);
    });

    it("fetches N pages and accumulates posts", async () => {
      await cmdGetPostsDay(db, "2026-01-01", 3, mockFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;
      expect(count).toBe(90);
    });

    it("stores posts with expected fields", async () => {
      await cmdGetPostsDay(db, "2026-01-01", 1, mockFetcher);
      const posts = getPosts(
        db,
        db
          .query<{ id: string }, []>("SELECT id FROM posts LIMIT 1")
          .all()
          .map((r) => r.id)
      );
      const post = posts[0]!;
      expect(post.title).toBeTruthy();
      expect(post.url).toMatch(/^https?:\/\//);
      expect(post.byUser).toBeTruthy();
    });

    it("is idempotent — running twice does not duplicate posts", async () => {
      await cmdGetPostsDay(db, "2026-01-01", 1, mockFetcher);
      const countBefore = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      await cmdGetPostsDay(db, "2026-01-01", 1, mockFetcher);
      const countAfter = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      expect(countBefore).toBe(countAfter);
    });
  });

  describe("get-posts-days", () => {
    it("iterates each day in range inclusive and saves posts", async () => {
      await cmdGetPostsDays(db, "2026-01-01", "2026-01-03", 1, mockFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;
      // 3 days × 1 page × 30 posts
      expect(count).toBe(90);
    });

    it("works for a single-day range", async () => {
      await cmdGetPostsDays(db, "2026-01-01", "2026-01-01", 1, mockFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;
      expect(count).toBe(30);
    });

    it("fetches N pages per day", async () => {
      await cmdGetPostsDays(db, "2026-01-01", "2026-01-02", 2, mockFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;
      // 2 days × 2 pages × 30 posts
      expect(count).toBe(120);
    });

    it("is idempotent — running twice does not duplicate posts", async () => {
      await cmdGetPostsDays(db, "2026-01-01", "2026-01-02", 1, mockFetcher);
      const countBefore = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      await cmdGetPostsDays(db, "2026-01-01", "2026-01-02", 1, mockFetcher);
      const countAfter = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      expect(countBefore).toBe(countAfter);
    });
  });

  describe("get-upvoted-all", () => {
    const upvotedFetcher = async (_user: string, _cookie: string): Promise<Post[]> =>
      Array.from({ length: 5 }, (_, i) => makePost(`upvoted_${i}`)).map((p) => ({
        ...p,
        upvoted: true,
      }));

    it("inserts upvoted posts and marks them as upvoted", async () => {
      await cmdGetUpvotedAll(db, "alice", "cookie123", upvotedFetcher);
      const count = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts WHERE upvoted = 1")
        .get()!.n;
      expect(count).toBe(5);
    });

    it("counts new vs total correctly when some posts already exist", async () => {
      // Pre-insert 2 posts as non-upvoted
      putPosts(db, [makePost("upvoted_0"), makePost("upvoted_1")]);

      await cmdGetUpvotedAll(db, "alice", "cookie123", upvotedFetcher);

      // All 5 should now be upvoted
      const upvotedCount = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts WHERE upvoted = 1")
        .get()!.n;
      expect(upvotedCount).toBe(5);
    });

    it("updates upvoted=true on existing posts", async () => {
      putPosts(db, [makePost("upvoted_0")]);
      expect(getPost(db, "upvoted_0")!.upvoted).toBe(false);

      await cmdGetUpvotedAll(db, "alice", "cookie123", upvotedFetcher);

      expect(getPost(db, "upvoted_0")!.upvoted).toBe(true);
    });

    it("is idempotent — running twice does not duplicate posts", async () => {
      await cmdGetUpvotedAll(db, "alice", "cookie123", upvotedFetcher);
      const countBefore = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      await cmdGetUpvotedAll(db, "alice", "cookie123", upvotedFetcher);
      const countAfter = db
        .query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts")
        .get()!.n;

      expect(countBefore).toBe(countAfter);
    });
  });
});
