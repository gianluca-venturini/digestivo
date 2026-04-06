import type { Database } from "bun:sqlite";
import type { Comment } from "./types.ts";

export function putComments(db: Database, comments: Comment[]): void {
  if (comments.length === 0) return;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO comments (id, postId, byUser, text)
    VALUES ($id, $postId, $byUser, $text)
  `);

  const run = db.transaction(() => {
    for (const c of comments) {
      insert.run({ $id: c.id, $postId: c.postId, $byUser: c.byUser, $text: c.text });
    }
  });

  run();
}

export function getComments(db: Database, postId: string): Comment[] {
  return db
    .query<Comment, [string]>("SELECT * FROM comments WHERE postId = ?")
    .all(postId);
}
