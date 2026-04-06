import { Database } from "bun:sqlite";

// Must be called before any new Database() in tests.
// Mirrors what the CLI entry point does in production.
const sqlitePath =
  process.env["SQLITE_PATH"] ?? "/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib";
Database.setCustomSQLite(sqlitePath);
