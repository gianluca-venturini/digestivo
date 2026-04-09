import { Database } from "bun:sqlite";

export function initDb(db: Database): void {
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA foreign_keys = ON");

  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      article TEXT,
      articleSummaryS TEXT,
      articleSummaryL TEXT,
      url TEXT NOT NULL,
      byUser TEXT NOT NULL,
      time TEXT NOT NULL,
      domain TEXT,
      upvoted INTEGER NOT NULL DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      postId TEXT NOT NULL REFERENCES posts(id),
      byUser TEXT NOT NULL,
      text TEXT NOT NULL
    )
  `);
}

export { Database };
