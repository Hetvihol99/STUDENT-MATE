import { DatabaseSync } from "node:sqlite";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  existsSync,
  unlinkSync,
} from "node:fs";
import path from "node:path";
// Development adapters only. Hosted routes never import this module.
export function localBindings(root) {
  mkdirSync(root, { recursive: true });
  const sqlite = new DatabaseSync(path.join(root, "study.sqlite"));
  sqlite.exec(
    "PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS local_migrations(name TEXT PRIMARY KEY)",
  );
  for (const name of readdirSync(new URL("../drizzle/", import.meta.url))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (
      sqlite.prepare("SELECT name FROM local_migrations WHERE name=?").get(name)
    )
      continue;
    sqlite.exec("BEGIN");
    try {
      sqlite.exec(
        readFileSync(new URL("../drizzle/" + name, import.meta.url), "utf8"),
      );
      sqlite.prepare("INSERT INTO local_migrations VALUES(?)").run(name);
      sqlite.exec("COMMIT");
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  }
  const DB = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) {
          this.args = args;
          return this;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...this.args) };
        },
        async first() {
          return sqlite.prepare(sql).get(...this.args) || null;
        },
        async run() {
          return sqlite.prepare(sql).run(...this.args);
        },
      };
    },
    async batch(statements) {
      sqlite.exec("BEGIN");
      try {
        const result = [];
        for (const s of statements) result.push(s.run());
        sqlite.exec("COMMIT");
        return result;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const files = path.join(root, "files");
  mkdirSync(files, { recursive: true });
  const file = (k) => path.join(files, Buffer.from(k).toString("hex"));
  const BUCKET = {
    async put(key, data) {
      writeFileSync(file(key), new Uint8Array(data));
    },
    async get(key) {
      const p = file(key);
      return existsSync(p) ? { body: readFileSync(p) } : null;
    },
    async delete(key) {
      const p = file(key);
      if (existsSync(p)) unlinkSync(p);
    },
  };
  return { DB, BUCKET, close: () => sqlite.close() };
}
