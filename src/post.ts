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

export function putTitleEmbedding(db: Database, postId: string, embedding: Float32Array): void {
  db.prepare("DELETE FROM vec_title_embeddings WHERE post_id = ?").run(postId);
  db.prepare("INSERT INTO vec_title_embeddings (post_id, embedding) VALUES (?, ?)").run(postId, embedding);
}

export function putArticleEmbedding(db: Database, postId: string, embedding: Float32Array): void {
  db.prepare("DELETE FROM vec_article_embeddings WHERE post_id = ?").run(postId);
  db.prepare("INSERT INTO vec_article_embeddings (post_id, embedding) VALUES (?, ?)").run(postId, embedding);
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

export function hasTitleEmbedding(db: Database, postId: string): boolean {
  return !!db.query("SELECT 1 FROM vec_title_embeddings WHERE post_id = ?").get(postId);
}

export function hasArticleEmbedding(db: Database, postId: string): boolean {
  return !!db.query("SELECT 1 FROM vec_article_embeddings WHERE post_id = ?").get(postId);
}

// ── Vector search (against upvoted posts only) ────────────────────────────────

export function getPostsTitleSimilar(
  db: Database,
  titleEmbedding: Float32Array,
  k: number
): { post: Post; distance: number }[] {
  // Over-fetch since we filter to upvoted only after the KNN query
  const rows = db
    .query<{ post_id: string; distance: number }, [Float32Array, number]>(
      "SELECT post_id, distance FROM vec_title_embeddings WHERE embedding MATCH ? AND k = ?"
    )
    .all(titleEmbedding, k * 4);

  if (rows.length === 0) return [];

  const postMap = new Map(
    getPosts(db, rows.map((r) => r.post_id)).map((p) => [p.id, p])
  );

  return rows
    .filter((r) => postMap.get(r.post_id)?.upvoted)
    .slice(0, k)
    .map((r) => ({ post: postMap.get(r.post_id)!, distance: r.distance }));
}

export function getPostsArticleSimilar(
  db: Database,
  articleEmbedding: Float32Array,
  k: number
): { post: Post; distance: number }[] {
  const rows = db
    .query<{ post_id: string; distance: number }, [Float32Array, number]>(
      "SELECT post_id, distance FROM vec_article_embeddings WHERE embedding MATCH ? AND k = ?"
    )
    .all(articleEmbedding, k * 4);

  if (rows.length === 0) return [];

  const postMap = new Map(
    getPosts(db, rows.map((r) => r.post_id)).map((p) => [p.id, p])
  );

  return rows
    .filter((r) => postMap.get(r.post_id)?.upvoted)
    .slice(0, k)
    .map((r) => ({ post: postMap.get(r.post_id)!, distance: r.distance }));
}
