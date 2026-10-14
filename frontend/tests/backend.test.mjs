import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { handle } from "../server/application.ts";
import { extract, verifyCitations, retrieve } from "../server/services.ts";
function fixture() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys=ON");
  sqlite.exec(
    readFileSync(
      new URL("../drizzle/0000_pale_genesis.sql", import.meta.url),
      "utf8",
    ),
  );
  const db = {
    prepare(sql) {
      return {
        sql,
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
        const out = [];
        for (const s of statements) out.push(await s.run());
        sqlite.exec("COMMIT");
        return out;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  const files = new Map();
  const bucket = {
    async put(k, v) {
      files.set(k, v instanceof ArrayBuffer ? new Uint8Array(v) : v);
    },
    async get(k) {
      return files.has(k) ? { body: files.get(k) } : null;
    },
    async delete(k) {
      files.delete(k);
    },
  };
  const env = { DB: db, BUCKET: bucket };
  const alice = { id: "test_alice", name: "Alice" },
    bob = { id: "test_bob", name: "Bob" };
  async function call(path, method = "GET", body, user = alice, headers = {}) {
    const isForm = body instanceof FormData;
    const req = new Request("https://study.test/api/study/" + path, {
      method,
      headers: {
        Origin: "https://study.test",
        "X-StudyMate-Request": "1",
        ...(!isForm && body !== undefined
          ? { "Content-Type": "application/json" }
          : {}),
        ...headers,
      },
      body:
        body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    });
    const r = await handle(req, env, user);
    const data = r.headers.get("content-type")?.includes("json")
      ? await r.json()
      : await r.text();
    return { status: r.status, data };
  }
  return { sqlite, db, files, env, alice, bob, call };
}
async function setup() {
  const f = fixture();
  assert.equal((await f.call("bootstrap", "POST", {})).status, 200);
  assert.equal((await f.call("seed", "POST", {})).status, 200);
  return f;
}
test("anonymous, forged input owner and cross-origin writes cannot bypass authorization", async () => {
  const f = fixture();
  assert.equal((await f.call("state", "GET", undefined, null)).status, 401);
  assert.equal(
    (
      await f.call("bootstrap", "POST", {}, f.alice, {
        Origin: "https://attacker.test",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await f.call("bootstrap", "POST", {}, f.alice, {
        "X-StudyMate-Request": "0",
      })
    ).status,
    403,
  );
  await f.call("bootstrap", "POST", {});
  assert.equal(
    (await f.call("courses", "POST", { name: "x", owner_id: f.bob.id })).status,
    400,
  );
});
test("sample seeding is idempotent, starts at zero, and persists across requests", async () => {
  const f = await setup();
  await f.call("seed", "POST", {});
  const { data: s } = await f.call("state");
  assert.equal(s.materials.length, 1);
  assert.equal(s.topics.length, 4);
  assert.ok(s.topics.every((t) => t.mastery === 0));
  assert.equal(f.files.size, 1);
  assert.equal(
    (await f.call("materials/" + s.materials[0].id + "/pages?page=2")).data
      .page,
    2,
  );
});
test("another student cannot read, rename, delete, quiz or chat with owner material", async () => {
  const f = await setup();
  const { data: s } = await f.call("state");
  const mid = s.materials[0].id;
  await f.call("bootstrap", "POST", {}, f.bob);
  assert.equal(
    (await f.call("state", "GET", undefined, f.bob)).data.materials.length,
    0,
  );
  for (const [path, method, body] of [
    [`materials/${mid}/file`, "GET"],
    [`materials/${mid}/pages?page=1`, "GET"],
    [`materials/${mid}`, "PATCH", { name: "Stolen" }],
    [`materials/${mid}`, "DELETE"],
    [
      "chat",
      "POST",
      {
        course: "DBMS Unit 1",
        materialId: mid,
        question: "key",
        style: "Simple",
      },
    ],
  ])
    assert.equal((await f.call(path, method, body, f.bob)).status, 404);
});
test("real text upload, source retrieval, rename and deletion remove stored content", async () => {
  const f = await setup();
  const form = new FormData();
  form.set("course", "DBMS Unit 1");
  form.set(
    "file",
    new File(
      ["A transaction is an atomic unit of database work."],
      "transactions.txt",
      { type: "text/plain" },
    ),
  );
  const up = await f.call("materials", "POST", form);
  assert.equal(up.status, 201, JSON.stringify(up.data));
  const mid = up.data.id;
  assert.match(
    (await f.call(`materials/${mid}/pages?page=1`)).data.text,
    /atomic/,
  );
  assert.equal(
    (await f.call(`materials/${mid}`, "PATCH", { name: "Transaction notes" }))
      .status,
    200,
  );
  await f.call("revision", "POST", { topic: mid });
  assert.equal((await f.call("state")).data.reviewed.includes(mid), true);
  assert.equal((await f.call(`materials/${mid}`, "DELETE")).status, 200);
  assert.equal((await f.call(`materials/${mid}/file`)).status, 404);
  assert.ok(!(await f.call("state")).data.topics.some((t) => t.id === mid));
  assert.equal(f.sqlite.prepare("SELECT count(*) n FROM revisions").get().n, 0);
});
test("corrupt PDF leaves an honest failed record; unsupported and oversized uploads reject", async () => {
  const f = await setup();
  async function upload(name, content, type) {
    const form = new FormData();
    form.set("course", "DBMS Unit 1");
    form.set("file", new File([content], name, { type }));
    return f.call("materials", "POST", form);
  }
  assert.equal(
    (await upload("bad.pdf", "not pdf", "application/pdf")).status,
    422,
  );
  assert.ok(
    (await f.call("state")).data.materials.some(
      (m) => m.status === "Processing failed",
    ),
  );
  assert.equal((await upload("movie.mp4", "x", "video/mp4")).status, 415);
  assert.equal(
    (await upload("huge.txt", "x".repeat(5 * 1024 * 1024 + 1), "text/plain"))
      .status,
    413,
  );
});
test("PDF parser extracts actual sample pages, and rejects binary text", async () => {
  const pages = await extract(
    new File(
      [
        readFileSync(
          new URL("../sample-materials/DBMS-Unit-1.pdf", import.meta.url),
        ),
      ],
      "notes.pdf",
      { type: "application/pdf" },
    ),
  );
  assert.equal(pages.length, 4);
  assert.match(pages[1], /primary key/i);
  await assert.rejects(
    () => extract(new File(["a\0b"], "binary.txt")),
    /Text must/,
  );
});
test("quiz hides keys until submission; grading and mastery save once and survive reload", async () => {
  const f = await setup();
  const s = (await f.call("state")).data;
  const made = await f.call("quizzes", "POST", {
    course: "DBMS Unit 1",
    materialId: s.materials[0].id,
    topic: "keys",
    type: "Mixed",
    difficulty: "Adaptive",
    count: 3,
    mode: "Practice quiz",
    source: "prepared",
  });
  assert.equal(made.status, 201, JSON.stringify(made.data));
  assert.ok(
    made.data.questions.every((q) => !("answer" in q) && !("explanation" in q)),
  );
  const privateQs = f.sqlite
    .prepare("SELECT data FROM questions WHERE quiz_id=?")
    .all(made.data.id)
    .map((x) => JSON.parse(x.data));
  const answers = Object.fromEntries(privateQs.map((q) => [q.id, q.answer]));
  const result = await f.call("quizzes/" + made.data.id + "/submit", "POST", {
    answers,
  });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.score, 100);
  const again = await f.call("quizzes/" + made.data.id + "/submit", "POST", {
    answers: {},
  });
  assert.equal(again.data.id, result.data.id);
  const fresh = (await f.call("state")).data;
  assert.equal(fresh.attempts.length, 1);
  assert.equal(fresh.topics.find((t) => t.id === "keys").mastery, 30);
  assert.equal(fresh.topics.find((t) => t.id === "keys").attempts, 3);
  await f.call("bootstrap", "POST", {}, f.bob);
  assert.equal(
    (
      await f.call(
        "quizzes/" + made.data.id + "/submit",
        "POST",
        { answers },
        f.bob,
      )
    ).status,
    404,
  );
  assert.equal(
    (await f.call("materials/" + s.materials[0].id, "DELETE")).status,
    200,
  );
  assert.equal((await f.call("state")).data.attempts.length, 0);
});
test("missing AI configuration fails clearly with no invented response or saved conversation", async () => {
  const f = await setup();
  const s = (await f.call("state")).data;
  const res = await f.call("chat", "POST", {
    course: "DBMS Unit 1",
    materialId: s.materials[0].id,
    question: "What is a primary key?",
    style: "Simple",
  });
  assert.equal(res.status, 503);
  assert.equal(res.data.code, "ai_unavailable");
  assert.deepEqual((await f.call("conversations")).data, []);
  const quiz = await f.call("quizzes", "POST", {
    course: "DBMS Unit 1",
    materialId: s.materials[0].id,
    topic: "all",
    type: "Mixed",
    difficulty: "Adaptive",
    count: 3,
    mode: "Practice quiz",
    source: "ai",
  });
  assert.equal(quiz.data.code, "ai_unavailable");
});
test("retrieval and citation checks reject invented source IDs or quotes", () => {
  const ev = [
    {
      id: "a",
      text: "A primary key uniquely identifies a row.",
      materialId: "m",
      page: 1,
      title: "Notes",
    },
  ];
  assert.equal(retrieve("primary key", ev).length, 1);
  assert.equal(retrieve("quantum computing", ev).length, 0);
  assert.equal(
    verifyCitations([{ id: "a", quote: "primary key uniquely" }], ev).length,
    1,
  );
  assert.throws(() =>
    verifyCitations([{ id: "a", quote: "invented fact" }], ev),
  );
  assert.throws(() => verifyCitations([{ id: "b", quote: "primary key" }], ev));
});

test("configured provider contract saves verified quotes and conversation history; isolation and deletion hold", async () => {
  const f = await setup();
  f.env.GEMINI_API_KEY = "test-placeholder";
  f.env.GEMINI_MODEL = "test-model";
  const s = (await f.call("state")).data;
  const original = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(url, /generativelanguage.googleapis.com/);
    const payload = JSON.parse(
      JSON.parse(options.body).contents[0].parts[0].text,
    );
    const source =
      payload.sources.find((p) => p.page === 2) || payload.sources[0];
    return Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  answer: "A primary key is unique and cannot contain NULL.",
                  supported: true,
                  citations: [
                    {
                      id: source.id,
                      quote:
                        "A primary key must be unique and cannot contain NULL.",
                    },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  };
  try {
    const answer = await f.call("chat", "POST", {
      course: "DBMS Unit 1",
      materialId: s.materials[0].id,
      question: "primary key",
      style: "Simple",
    });
    assert.equal(answer.status, 200, JSON.stringify(answer.data));
    assert.equal(answer.data.sources[0].page, 2);
    assert.equal((await f.call("conversations")).data[0].messages.length, 2);
    await f.call("bootstrap", "POST", {}, f.bob);
    assert.deepEqual(
      (await f.call("conversations", "GET", undefined, f.bob)).data,
      [],
    );
    assert.equal(
      (
        await f.call(
          "conversations/" + answer.data.conversationId,
          "DELETE",
          undefined,
          f.bob,
        )
      ).status,
      404,
    );
    assert.equal(
      (await f.call("conversations/" + answer.data.conversationId, "DELETE"))
        .status,
      200,
    );
    assert.deepEqual((await f.call("conversations")).data, []);
  } finally {
    globalThis.fetch = original;
  }
});
test("invalid generated citation is rejected without saving a fabricated tutor answer", async () => {
  const f = await setup();
  f.env.GEMINI_API_KEY = "test-placeholder";
  f.env.GEMINI_MODEL = "test-model";
  const s = (await f.call("state")).data;
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  answer: "Unfounded answer",
                  supported: true,
                  citations: [
                    { id: "fabricated", quote: "This does not exist" },
                  ],
                }),
              },
            ],
          },
        },
      ],
    });
  try {
    const answer = await f.call("chat", "POST", {
      course: "DBMS Unit 1",
      materialId: s.materials[0].id,
      question: "primary key",
      style: "Simple",
    });
    assert.equal(answer.status, 502);
    assert.deepEqual((await f.call("conversations")).data, []);
  } finally {
    globalThis.fetch = original;
  }
});
