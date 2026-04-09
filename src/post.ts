import type { Database } from "bun:sqlite";
import type { Post } from "./types.ts";

// ── Write ────────────────────────────────────────────────────────────────────

export function putPosts(db: Database, posts: Post[]): void {
  if (posts.length === 0) return;

  const upsert = db.prepare(`
    INSERT INTO posts (id, title, article, articleSummaryS, articleSummaryL, url, byUser, time, domain, upvoted)
    VALUES ($id, $title, $article, $articleSummaryS, $articleSummaryL, $url, $byUser, $time, $domain, $upvoted)
    ON CONFLICT(id) DO UPDATE SET
      title           = excluded.title,
      article         = excluded.article,
      articleSummaryS = excluded.articleSummaryS,
      articleSummaryL = excluded.articleSummaryL,
      url             = excluded.url,
      byUser          = excluded.byUser,
      time            = excluded.time,
      domain          = excluded.domain,
      upvoted         = excluded.upvoted
  `);

  const run = db.transaction(() => {
    for (const p of posts) {
      upsert.run({
        $id: p.id,
        $title: p.title,
        $article: p.article,
        $articleSummaryS: p.articleSummaryS,
        $articleSummaryL: p.articleSummaryL,
        $url: p.url,
        $byUser: p.byUser,
        $time: p.time,
        $domain: p.domain,
        $upvoted: p.upvoted ? 1 : 0,
      });
    }
  });

  run();
}

// ── Read ─────────────────────────────────────────────────────────────────────

type PostRow = Omit<Post, "upvoted"> & { upvoted: number };
const toPost = (r: PostRow): Post => ({ ...r, upvoted: r.upvoted === 1 });

export function getPost(db: Database, id: string): Post | null {
  const row = db.query<PostRow, [string]>("SELECT * FROM posts WHERE id = ?").get(id);
  return row ? toPost(row) : null;
}

export function getPosts(db: Database, ids: string[]): Post[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  return db
    .query<PostRow, string[]>(`SELECT * FROM posts WHERE id IN (${placeholders})`)
    .all(...ids)
    .map(toPost);
}

