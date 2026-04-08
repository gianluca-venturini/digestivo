import { describe, it, expect, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import { cmdGetPostsDay, cmdGetPostsDays, cmdGetUpvotedAll, cmdPostFetchArticle, cmdPostComputeMetadata, cmdGetPost } from "./run.ts";
import { getPosts } from "./post.ts";
import { getPost, putPosts, hasTitleEmbedding, hasArticleEmbedding } from "./post.ts";
import type { Post } from "./types.ts";

const makePost = (id: string): Post => ({
  id,
  title: `Post ${id}`,
  article: null,
  articleSummaryS: null,
  articleSummaryL: null,
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
      await cmdGetUpvotedAll(db, "alice", "token", upvotedFetcher);
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

  describe("post-fetch-article", () => {
    const mockFetchSafe = async (_url: string): Promise<string | null> =>
      "This is the article content.";
    const mockFetchSafeNull = async (_url: string): Promise<string | null> => null;

    it("fetches and saves article content", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostFetchArticle(db, "p1", mockFetchSafe);
      expect(getPost(db, "p1")!.article).toBe("This is the article content.");
    });

    it("skips if article already set (idempotent)", async () => {
      putPosts(db, [{ ...makePost("p1"), article: "existing content" }]);
      const callTracker = { called: false };
      await cmdPostFetchArticle(db, "p1", async (_url) => {
        callTracker.called = true;
        return "new content";
      });
      expect(callTracker.called).toBe(false);
      expect(getPost(db, "p1")!.article).toBe("existing content");
    });

    it("leaves article null when fetcher returns null", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostFetchArticle(db, "p1", mockFetchSafeNull);
      expect(getPost(db, "p1")!.article).toBeNull();
    });
  });

  describe("get-post", () => {
    const mockHnFetcher = async (id: string) => makePost(id);
    const mockEmbed = async (_text: string): Promise<Float32Array> =>
      new Float32Array(384).fill(0.5);
    const mockFetchSafe = async (_url: string): Promise<string | null> =>
      "Article content.";
    const mockFetchSafeNull = async (_url: string): Promise<string | null> => null;
    const mockSummarize = async (_text: string, style: "S" | "L"): Promise<string | null> =>
      style === "S" ? "Short summary." : "Long summary.";

    it("fetches from HN and saves the post", async () => {
      await cmdGetPost(db, "42", mockHnFetcher, mockEmbed, mockFetchSafeNull, mockSummarize);
      expect(getPost(db, "42")).not.toBeNull();
    });

    it("saves title and url from HN fetcher", async () => {
      await cmdGetPost(db, "42", mockHnFetcher, mockEmbed, mockFetchSafeNull, mockSummarize);
      const post = getPost(db, "42")!;
      expect(post.title).toBe("Post 42");
      expect(post.url).toBe("https://example.com/42");
    });

    it("computes metadata (article, summaries, embeddings)", async () => {
      await cmdGetPost(db, "42", mockHnFetcher, mockEmbed, mockFetchSafe, mockSummarize);
      const post = getPost(db, "42")!;
      expect(post.article).toBe("Article content.");
      expect(post.articleSummaryS).toBe("Short summary.");
      expect(post.articleSummaryL).toBe("Long summary.");
      expect(hasTitleEmbedding(db, "42")).toBe(true);
      expect(hasArticleEmbedding(db, "42")).toBe(true);
    });

    it("is idempotent — running twice does not duplicate or reset", async () => {
      await cmdGetPost(db, "42", mockHnFetcher, mockEmbed, mockFetchSafe, mockSummarize);
      const embedCallCount = { n: 0 };
      await cmdGetPost(db, "42", mockHnFetcher, async (text) => {
        embedCallCount.n++;
        return mockEmbed(text);
      }, mockFetchSafe, mockSummarize);
      expect(embedCallCount.n).toBe(0);
      const count = db.query<{ n: number }, []>("SELECT COUNT(*) as n FROM posts").get()!.n;
      expect(count).toBe(1);
    });
  });

  describe("post-compute-metadata", () => {
    const mockEmbed = async (_text: string): Promise<Float32Array> =>
      new Float32Array(384).fill(0.5);
    const mockFetcher = async (_url: string): Promise<string | null> =>
      "Fetched article text.";
    const mockFetcherNull = async (_url: string): Promise<string | null> => null;
    const mockSummarize = async (_text: string, style: "S" | "L"): Promise<string | null> =>
      style === "S" ? "Short summary." : "Long summary.";

    it("extracts domain from url", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, mockSummarize);
      expect(getPost(db, "p1")!.domain).toBe("example.com");
    });

    it("strips www. prefix from domain", async () => {
      putPosts(db, [{ ...makePost("p1"), url: "https://www.example.com/article" }]);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, mockSummarize);
      expect(getPost(db, "p1")!.domain).toBe("example.com");
    });

    it("fetches article when missing", async () => {
      putPosts(db, [makePost("p1")]); // article is null
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcher, mockSummarize);
      expect(getPost(db, "p1")!.article).toBe("Fetched article text.");
    });

    it("skips article fetch when already set", async () => {
      putPosts(db, [{ ...makePost("p1"), article: "existing" }]);
      const callCount = { n: 0 };
      await cmdPostComputeMetadata(db, "p1", mockEmbed, async (_url) => {
        callCount.n++;
        return "new";
      }, mockSummarize);
      expect(callCount.n).toBe(0);
      expect(getPost(db, "p1")!.article).toBe("existing");
    });

    it("computes title embedding", async () => {
      putPosts(db, [makePost("p1")]);
      expect(hasTitleEmbedding(db, "p1")).toBe(false);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, mockSummarize);
      expect(hasTitleEmbedding(db, "p1")).toBe(true);
    });

    it("computes article embedding after fetching article", async () => {
      putPosts(db, [makePost("p1")]); // article is null
      expect(hasArticleEmbedding(db, "p1")).toBe(false);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcher, mockSummarize);
      expect(hasArticleEmbedding(db, "p1")).toBe(true);
    });

    it("skips article embedding when article fetch fails", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, mockSummarize);
      expect(hasArticleEmbedding(db, "p1")).toBe(false);
    });

    it("is idempotent — does not re-embed if already computed", async () => {
      putPosts(db, [makePost("p1")]);
      const callCount = { n: 0 };
      const trackingEmbed = async (text: string) => {
        callCount.n++;
        return mockEmbed(text);
      };
      await cmdPostComputeMetadata(db, "p1", trackingEmbed, mockFetcherNull, mockSummarize);
      const firstCount = callCount.n;
      await cmdPostComputeMetadata(db, "p1", trackingEmbed, mockFetcherNull, mockSummarize);
      expect(callCount.n).toBe(firstCount);
    });

    it("generates article summaries when article is present", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcher, mockSummarize);
      const post = getPost(db, "p1")!;
      expect(post.articleSummaryS).toBe("Short summary.");
      expect(post.articleSummaryL).toBe("Long summary.");
    });

    it("skips summaries when article is null", async () => {
      putPosts(db, [makePost("p1")]);
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, mockSummarize);
      const post = getPost(db, "p1")!;
      expect(post.articleSummaryS).toBeNull();
      expect(post.articleSummaryL).toBeNull();
    });

    it("skips summaries when already set", async () => {
      putPosts(db, [{ ...makePost("p1"), article: "text", articleSummaryS: "existing S", articleSummaryL: "existing L" }]);
      const callCount = { n: 0 };
      const trackingSummarize = async (text: string, style: "S" | "L"): Promise<string | null> => {
        callCount.n++;
        return mockSummarize(text, style);
      };
      await cmdPostComputeMetadata(db, "p1", mockEmbed, mockFetcherNull, trackingSummarize);
      expect(callCount.n).toBe(0);
      expect(getPost(db, "p1")!.articleSummaryS).toBe("existing S");
      expect(getPost(db, "p1")!.articleSummaryL).toBe("existing L");
    });
  });
});
