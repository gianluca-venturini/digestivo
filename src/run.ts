import { Database } from "bun:sqlite";
import { initDb } from "./db.ts";
import type { Post } from "./types.ts";
import { getPage, getUpvoted, getPostById } from "./hackernews.ts";
import { getPost, putPosts } from "./post.ts";
import { fetchSafe } from "./utils.ts";
import { summarize } from "./summarize.ts";

// ── Commands ──────────────────────────────────────────────────────────────────
// Each command receives (db, ...rawStringArgs) and handles its own arg parsing.

export async function cmdGetPostsDay(
  db: Database,
  day: string,
  n: number,
  fetcher: typeof getPage = getPage
): Promise<void> {
  let total = 0;
  for (let page = 1; page <= n; page++) {
    const posts = await fetcher(day, page);
    putPosts(db, posts);
    total += posts.length;
    console.log(`  page ${page}/${n}: ${posts.length} posts`);
  }
  console.log(`get-posts-day ${day}: saved ${total} posts`);
}

export async function cmdGetPostsDays(
  db: Database,
  start: string,
  end: string,
  n: number,
  fetcher: typeof getPage = getPage
): Promise<void> {
  const current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    const day = current.toISOString().slice(0, 10);
    await cmdGetPostsDay(db, day, n, fetcher);
    current.setUTCDate(current.getUTCDate() + 1);
  }
}

export async function cmdGetUpvotedAll(
  db: Database,
  user: string,
  cookie: string,
  fetcher: typeof getUpvoted = getUpvoted
): Promise<void> {
  const posts = await fetcher(user, cookie);
  const newPosts = posts.filter((p) => !getPost(db, p.id));
  // Upsert all — existing posts get upvoted=true updated, new ones are inserted
  putPosts(db, posts);
  console.log(`get-upvoted-all: ${newPosts.length} new / ${posts.length} total`);
}

export async function cmdPostFetchArticle(
  db: Database,
  postId: string,
  fetcher: typeof fetchSafe = fetchSafe
): Promise<void> {
  const post = getPost(db, postId);
  if (!post) {
    console.error(`post-fetch-article: post ${postId} not found`);
    process.exit(1);
  }
  if (post.article !== null) {
    console.log(`post-fetch-article ${postId}: already has article, skipping`);
    return;
  }
  const article = await fetcher(post.url);
  if (article === null) {
    console.warn(`post-fetch-article ${postId}: could not fetch article`);
    return;
  }
  putPosts(db, [{ ...post, article }]);
  console.log(`post-fetch-article ${postId}: saved ${article.length} chars`);
}

export async function cmdPostComputeMetadata(
  db: Database,
  postId: string,
  fetcher: typeof fetchSafe = fetchSafe,
  summarizer: typeof summarize = summarize
): Promise<Post> {
  let post = getPost(db, postId);
  if (!post) {
    console.error(`post-compute-metadata: post ${postId} not found`);
    process.exit(1);
  }

  const computed: string[] = [];

  // Domain extraction
  if (!post.domain) {
    const hostname = new URL(post.url).hostname.replace(/^www\./, "");
    post = { ...post, domain: hostname };
    putPosts(db, [post]);
    computed.push(`domain=${hostname}`);
  }

  // Article fetch
  if (!post.article) {
    const article = await fetcher(post.url);
    if (article) {
      post = { ...post, article };
      putPosts(db, [post]);
      computed.push("article");
    }
  }

  // Article summaries
  if (post.article && !post.articleSummaryS) {
    const summaryS = await summarizer(post.article, "S");
    if (summaryS) {
      post = { ...post, articleSummaryS: summaryS };
      putPosts(db, [post]);
      computed.push("articleSummaryS");
    }
  }
  if (post.article && !post.articleSummaryL) {
    const summaryL = await summarizer(post.article, "L");
    if (summaryL) {
      post = { ...post, articleSummaryL: summaryL };
      putPosts(db, [post]);
      computed.push("articleSummaryL");
    }
  }

  if (computed.length === 0) {
    console.log(`post-compute-metadata ${postId}: nothing to compute`);
  } else {
    console.log(`post-compute-metadata ${postId}: computed ${computed.join(", ")}`);
  }
  return post;
}

export async function cmdPostGetComputeMetadata(
  db: Database,
  postId: string,
  hnFetcher: typeof getPostById = getPostById,
  fetcher: typeof fetchSafe = fetchSafe,
  summarizer: typeof summarize = summarize
): Promise<Post> {
  if (!getPost(db, postId)) {
    const post = await hnFetcher(postId);
    putPosts(db, [post]);
    console.log(`post-get-compute-metadata ${postId}: saved post "${post.title}"`);
  }
  return await cmdPostComputeMetadata(db, postId, fetcher, summarizer);
}

export const commands: Record<string, (db: Database, ...args: string[]) => Promise<void>> = {
  async "get-posts-day"(db, dayArg, nArg) {
    const day = dayArg;
    const n = parseInt(nArg ?? "1", 10);
    if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || isNaN(n) || n < 1) {
      console.error("Usage: get-posts-day <YYYY-MM-DD> <N>");
      process.exit(1);
    }
    await cmdGetPostsDay(db, day, n);
  },

  async "post-compute-metadata"(db, postIdArg) {
    if (!postIdArg) {
      console.error("Usage: post-compute-metadata <postId>");
      process.exit(1);
    }
    await cmdPostComputeMetadata(db, postIdArg);
  },

  async "post-fetch-article"(db, postIdArg) {
    if (!postIdArg) {
      console.error("Usage: post-fetch-article <postId>");
      process.exit(1);
    }
    await cmdPostFetchArticle(db, postIdArg);
  },

  async "get-upvoted-all"(db) {
    const user = process.env["HN_USER"];
    const cookie = process.env["HN_COOKIE"];
    if (!user || !cookie) {
      console.error("HN_USER and HN_COOKIE must be set in environment");
      process.exit(1);
    }
    await cmdGetUpvotedAll(db, user, cookie);
  },

  async "post-get-compute-metadata"(db, postIdArg) {
    if (!postIdArg) {
      console.error("Usage: post-get-compute-metadata <postId>");
      process.exit(1);
    }
    await cmdPostGetComputeMetadata(db, postIdArg);
  },

  async "get-posts-days"(db, startArg, endArg, nArg) {
    const start = startArg;
    const end = endArg;
    const n = parseInt(nArg ?? "1", 10);
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (!start || !dateRe.test(start) || !end || !dateRe.test(end) || isNaN(n) || n < 1 || start > end) {
      console.error("Usage: get-posts-days <YYYY-MM-DD> <YYYY-MM-DD> <N>");
      process.exit(1);
    }
    await cmdGetPostsDays(db, start, end, n);
  },
};

// ── CLI entry point ───────────────────────────────────────────────────────────

if (import.meta.main) {
  const sqlitePath =
    process.env["SQLITE_PATH"] ??
    "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib";
  Database.setCustomSQLite(sqlitePath);
  const db = new Database("hn.db");
  initDb(db);

  const [cmd, ...args] = process.argv.slice(2);
  const available = Object.keys(commands).join(", ");

  if (!cmd || !(cmd in commands)) {
    console.error(cmd ? `Unknown command: ${cmd}` : "No command provided.");
    console.error(`Available commands: ${available}`);
    process.exit(1);
  }

  await commands[cmd]!(db, ...args);
}
