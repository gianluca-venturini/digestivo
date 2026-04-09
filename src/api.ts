import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { initDb } from "./db.ts";
import { cmdPostGetComputeMetadata } from "./run.ts";

const sqlitePath =
  process.env["SQLITE_PATH"] ?? "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib";
Database.setCustomSQLite(sqlitePath);
const db = new Database("hn.db");
initDb(db);

const app = new Hono();

app.use("*", cors({ origin: "*" }));

// Chrome Private Network Access: respond to preflight with permission
app.options("*", (c) => {
  c.header("Access-Control-Allow-Private-Network", "true");
  c.header("Access-Control-Max-Age", "86400");
  return c.body(null, 204);
});

app.post("/post/:id", async (c) => {
  const id = c.req.param("id");
  const post = await cmdPostGetComputeMetadata(db, id);
  return c.json(post);
});

export default app;

const port = Number(process.env["PORT"] ?? 3001);
Bun.serve({ fetch: app.fetch, port, idleTimeout: 120 });
console.log(`API listening on http://localhost:${port}`);
