import { z } from "zod";
import {
  initialTopics,
  questionBank,
  grade,
  selectQuestions,
  type Question,
} from "../lib/demo.ts";
import { samplePdfBase64 } from "./sample-pdf.ts";
import {
  ApiError,
  reject,
  id,
  text,
  bodyBytes,
  jsonBody,
  extract,
  retrieve,
  generate,
  verifyCitations,
  citationInput,
  type Evidence,
} from "./services.ts";
type Bindings = {
  DB?: D1Database;
  BUCKET?: R2Bucket;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};
type User = { id: string; name: string };
const now = () => new Date().toISOString();
const uuid = () => crypto.randomUUID();
const response = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
function stmt(db: D1Database, sql: string, ...args: any[]) {
  return db.prepare(sql).bind(...args);
}
async function rows(db: D1Database, sql: string, ...args: any[]) {
  return (await stmt(db, sql, ...args).all<any>()).results;
}
async function one(db: D1Database, sql: string, ...args: any[]) {
  return stmt(db, sql, ...args).first<any>();
}
async function ownedCourse(db: D1Database, user: string, name: string) {
  const c = await one(
    db,
    "SELECT * FROM courses WHERE owner_id=? AND (id=? OR name=?)",
    user,
    name,
    name,
  );
  if (!c) reject(404, "not_found", "Course not found.");
  return c;
}
async function ownedMaterial(db: D1Database, user: string, mid: string) {
  const m = await one(
    db,
    "SELECT * FROM materials WHERE id=? AND owner_id=? AND deleted_at IS NULL",
    mid,
    user,
  );
  if (!m) reject(404, "not_found", "Material not found.");
  return m;
}
async function rate(
  db: D1Database,
  user: string,
  bucket: string,
  limit: number,
) {
  const time = Date.now(),
    key = user + ":" + bucket;
  const row = await stmt(
    db,
    "INSERT INTO rate_limits(key,count,reset_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<=? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<=? THEN ? ELSE reset_at END RETURNING count",
    key,
    time + 3600000,
    time,
    time,
    time + 3600000,
  ).first<any>();
  if (row.count > limit)
    reject(
      429,
      "rate_limit",
      "Hourly request limit reached. Please try later.",
    );
}
function event(db: D1Database, user: string, message: string) {
  return stmt(
    db,
    "INSERT INTO activity(id,owner_id,text,created_at) VALUES(?,?,?,?)",
    uuid(),
    user,
    message,
    now(),
  );
}
async function hash(s: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}
async function addSource(db: D1Database, mid: string, pages: string[]) {
  const list: D1PreparedStatement[] = [];
  for (let i = 0; i < pages.length; i++) {
    const pid = uuid();
    list.push(
      stmt(
        db,
        "INSERT INTO pages(id,material_id,page,text) VALUES(?,?,?,?)",
        pid,
        mid,
        i + 1,
        pages[i],
      ),
    );
    for (let off = 0, j = 0; off < pages[i].length; off += 1800, j++)
      list.push(
        stmt(
          db,
          "INSERT INTO chunks(id,page_id,ordinal,text) VALUES(?,?,?,?)",
          uuid(),
          pid,
          j,
          pages[i].slice(off, off + 2000),
        ),
      );
  }
  for (let i = 0; i < list.length; i += 50)
    await db.batch(list.slice(i, i + 50));
}
async function seed(db: D1Database, bucket: R2Bucket, user: User) {
  const prefix = await hash(user.id),
    mid = "notes_" + prefix;
  const existingCourse = await one(
    db,
    "SELECT id FROM courses WHERE owner_id=? AND lower(name)=lower(?)",
    user.id,
    "DBMS Unit 1",
  );
  const cid = existingCourse?.id || "sample_" + prefix;
  if (
    await one(
      db,
      "SELECT id FROM materials WHERE id=? AND deleted_at IS NULL AND status=?",
      mid,
      "ready",
    )
  )
    return;
  const bytes = Uint8Array.from(atob(samplePdfBase64), (c) => c.charCodeAt(0));
  await bucket.put(user.id + "/" + mid, bytes, {
    httpMetadata: { contentType: "application/pdf" },
  });
  const sqls = [
    stmt(
      db,
      "INSERT OR IGNORE INTO courses(id,owner_id,name,created_at) VALUES(?,?,?,?)",
      cid,
      user.id,
      "DBMS Unit 1",
      now(),
    ),
    stmt(
      db,
      "INSERT INTO materials(id,owner_id,course_id,name,type,status,storage_key,bytes,pages,seeded,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,deleted_at=NULL,error=NULL",
      mid,
      user.id,
      cid,
      "DBMS Unit 1 — Learning notes.pdf",
      "PDF",
      "processing",
      user.id + "/" + mid,
      bytes.length,
      4,
      1,
      now(),
    ),
  ];
  for (const t of initialTopics) {
    const tid = prefix + "_" + t.id;
    sqls.push(
      stmt(
        db,
        "INSERT OR IGNORE INTO topics(id,owner_id,course_id,name,data,mastery,attempts,correct,last) VALUES(?,?,?,?,?,0,0,0,?)",
        tid,
        user.id,
        cid,
        t.name,
        JSON.stringify({
          ...t,
          materialId: mid,
          sourceTitle: "DBMS learning notes",
        }),
        "Not practiced",
      ),
    );
    sqls.push(
      stmt(
        db,
        "INSERT OR IGNORE INTO flashcards(id,owner_id,topic_id,front,back) VALUES(?,?,?,?,?)",
        tid + "_card",
        user.id,
        tid,
        "How would you explain " + t.name + "?",
        t.text,
      ),
    );
  }
  await db.batch(sqls);
  await stmt(db, "DELETE FROM pages WHERE material_id=?", mid).run();
  await addSource(
    db,
    mid,
    initialTopics.map((t) => t.text + "\n\nWorked example\n" + t.example),
  );
  await db.batch([
    stmt(db, "UPDATE materials SET status=? WHERE id=?", "ready", mid),
    event(db, user.id, "Added prepared DBMS learning material"),
  ]);
}
async function state(db: D1Database, env: Bindings, user: User) {
  const profile = await one(
    db,
    "SELECT name FROM profiles WHERE id=?",
    user.id,
  );
  const cs = await rows(
    db,
    "SELECT id,name FROM courses WHERE owner_id=? ORDER BY created_at,id",
    user.id,
  );
  const ms = await rows(
    db,
    "SELECT m.*,c.name AS course FROM materials m JOIN courses c ON c.id=m.course_id WHERE m.owner_id=? AND m.deleted_at IS NULL ORDER BY m.created_at DESC",
    user.id,
  );
  const ts = await rows(
    db,
    "SELECT * FROM topics WHERE owner_id=? ORDER BY course_id,id",
    user.id,
  );
  const ats = await rows(
    db,
    "SELECT data FROM attempts WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",
    user.id,
  );
  const acts = await rows(
    db,
    "SELECT text FROM activity WHERE owner_id=? ORDER BY created_at DESC LIMIT 30",
    user.id,
  );
  const revs = await rows(
    db,
    "SELECT DISTINCT t.data FROM revisions r JOIN topics t ON t.id=r.topic_id WHERE r.owner_id=?",
    user.id,
  );
  return {
    user: { name: profile?.name || user.name },
    aiAvailable: !!(env.GEMINI_API_KEY && env.GEMINI_MODEL),
    courses: cs.map((c) => c.name),
    courseRecords: cs,
    materials: ms.map((m) => ({
      id: m.id,
      name: m.name,
      course: m.course,
      courseId: m.course_id,
      type: m.type,
      status:
        (
          {
            ready: "Ready to study",
            processing: "Processing",
            failed: "Processing failed",
            deleting: "Deleting",
          } as any
        )[m.status] || m.status,
      date: m.created_at,
      seeded: !!m.seeded,
      url: "/api/study/materials/" + m.id + "/file",
      error: m.error,
      pages: m.pages,
    })),
    topics: ts.map((t) => ({
      ...JSON.parse(t.data),
      dbId: t.id,
      mastery: t.mastery,
      attempts: t.attempts,
      correct: t.correct,
      last: t.last,
    })),
    attempts: ats.map((a) => JSON.parse(a.data)),
    activity: acts.map((a) => a.text),
    reviewed: revs.map((r) => JSON.parse(r.data).id),
  };
}
async function evidence(
  db: D1Database,
  user: string,
  cid: string,
  mid?: string,
): Promise<Evidence[]> {
  return rows(
    db,
    "SELECT ch.id,ch.text,p.page,m.id AS materialId,m.name AS title FROM chunks ch JOIN pages p ON p.id=ch.page_id JOIN materials m ON m.id=p.material_id WHERE m.owner_id=? AND m.course_id=? AND m.status=? AND m.deleted_at IS NULL" +
      (mid ? " AND m.id=?" : "") +
      " ORDER BY m.created_at DESC,p.page,ch.ordinal LIMIT 500",
    ...[user, cid, "ready", ...(mid ? [mid] : [])],
  );
}
const chatSchema = z
  .object({
    course: text,
    materialId: id,
    conversationId: id.optional(),
    question: z.string().trim().min(1).max(2000),
    style: z.enum(["Simple", "Step-by-step", "Exam-focused", "With examples"]),
  })
  .strict();
function quizOutputSchema(count: number, type: string, difficulty: string) {
  return {type: "object", required: ["questions"], properties: {
    questions: {type: "array", minItems: count, maxItems: count, items: {
      type: "object", required: ["type", "difficulty", "prompt", "answer", "aliases", "options", "explanation", "citation"],
      properties: {
        type: {type: "string", enum: type === "Mixed" ? ["MCQ", "Short answer", "Numerical"] : [type]},
        difficulty: {type: "string", enum: difficulty === "Adaptive" ? ["Easy", "Medium"] : [difficulty]},
        prompt: {type: "string"}, answer: {type: "string", description: "MCQ answers must exactly match the full text of one option. Numerical answers must be finite number strings."},
        aliases: {type: "array", items: {type: "string"}}, options: {type: "array", items: {type: "string"}},
        explanation: {type: "string"}, citation: {type: "object", required: ["id", "quote"], properties: {id: {type: "string"}, quote: {type: "string", minLength: 5, maxLength: 1200}}},
      },
    }},
  }};
}
const questionSchema = z.object({
  type: z.enum(["MCQ", "Short answer", "Numerical"]),
  difficulty: z.enum(["Easy", "Medium"]),
  prompt: z.string().min(5).max(1500),
  answer: z.string().min(1).max(500),
  aliases: z.array(z.string().max(500)).max(5).optional(),
  options: z.array(z.string().max(500)).max(5).optional(),
  explanation: z.string().min(5).max(1500),
  citation: citationInput,
});
export async function handle(
  req: Request,
  env: Bindings,
  user: User | null,
): Promise<Response> {
  try {
    const path = new URL(req.url).pathname
      .replace(/^\/api\/study\/?/, "")
      .split("/")
      .filter(Boolean);
    const method = req.method;
    if (path[0] === "auth" && path[1] === "config" && method === "GET")
      return response({provider: "chatgpt"});
    if (!user)
      return response(
        {
          error: "Sign in with ChatGPT to access your private learning data.",
          code: "unauthenticated",
        },
        401,
      );
    if (
      method !== "GET" &&
      (req.headers.get("Origin") !== new URL(req.url).origin ||
        req.headers.get("X-StudyMate-Request") !== "1" ||
        req.headers.get("Sec-Fetch-Site") === "cross-site")
    )
      reject(403, "origin", "Use the application to submit this request.");
    if (!env.DB || !env.BUCKET)
      reject(
        503,
        "storage_unavailable",
        "Database or file storage is unavailable. Complete the platform binding setup.",
      );
    const db = env.DB,
      bucket = env.BUCKET;
    if (path[0] === "state" && method === "GET")
      return response(await state(db, env, user));
    if (path[0] === "bootstrap" && method === "POST") {
      await stmt(
        db,
        "INSERT OR IGNORE INTO profiles(id,name,created_at) VALUES(?,?,?)",
        user.id,
        user.name.slice(0, 120),
        now(),
      ).run();
      return response(await state(db, env, user));
    }
    if (!(await one(db, "SELECT id FROM profiles WHERE id=?", user.id)))
      reject(409, "profile_required", "Initialize your workspace first.");
    if (path[0] === "seed" && method === "POST") {
      await rate(db, user.id, "seed", 10);
      await seed(db, bucket, user);
      return response(await state(db, env, user));
    }
    if (path[0] === "profile" && method === "PATCH") {
      const b = z
        .object({ name: text })
        .strict()
        .parse(await jsonBody(req));
      await stmt(
        db,
        "UPDATE profiles SET name=? WHERE id=?",
        b.name,
        user.id,
      ).run();
      return response({ saved: true });
    }
    if (path[0] === "courses" && method === "POST") {
      const b = z
        .object({ name: text })
        .strict()
        .parse(await jsonBody(req));
      if (
        (await rows(db, "SELECT id FROM courses WHERE owner_id=?", user.id))
          .length >= 30
      )
        reject(409, "quota", "Course limit reached (30).");
      if (
        await one(
          db,
          "SELECT id FROM courses WHERE owner_id=? AND lower(name)=lower(?)",
          user.id,
          b.name,
        )
      )
        reject(409, "duplicate", "A course with this name already exists.");
      const cid = uuid();
      await db.batch([
        stmt(
          db,
          "INSERT INTO courses(id,owner_id,name,created_at) VALUES(?,?,?,?)",
          cid,
          user.id,
          b.name,
          now(),
        ),
        event(db, user.id, "Created course " + b.name),
      ]);
      return response({ id: cid, name: b.name }, 201);
    }
    if (path[0] === "materials" && path.length === 1 && method === "POST") {
      await rate(db, user.id, "upload", 10);
      const count = await one(
        db,
        "SELECT count(*) AS n FROM materials WHERE owner_id=? AND deleted_at IS NULL",
        user.id,
      );
      if (count.n >= 50)
        reject(
          409,
          "quota",
          "Material limit reached (50). Delete unused files first.",
        );
      const bytes = await bodyBytes(req, 5 * 1024 * 1024 + 65536);
      let form: FormData;
      try {
        form = await new Response(bytes, {
          headers: { "Content-Type": req.headers.get("Content-Type") || "" },
        }).formData();
      } catch {
        reject(400, "form", "Provide a multipart file and course.");
      }
      const course = text.parse(form!.get("course"));
      const c = await ownedCourse(db, user.id, course);
      const file = form!.get("file");
      if (!(file instanceof File))
        reject(400, "file_required", "Select a file to upload.");
      if (!file.size || file.size > 5 * 1024 * 1024)
        reject(413, "file_size", "Choose a non-empty file up to 5 MB.");
      if (!/\.(pdf|txt|md)$/i.test(file.name))
        reject(
          415,
          "unsupported",
          "Supported formats: text-based PDF, TXT, Markdown.",
        );
      const name = file.name.replace(/[\x00-\x1f/\\]/g, "_").slice(0, 150),
        mid = uuid(),
        key = user.id + "/" + mid;
      await stmt(
        db,
        "INSERT INTO materials(id,owner_id,course_id,name,type,status,storage_key,bytes,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
        mid,
        user.id,
        c.id,
        name,
        /\.pdf$/i.test(name) ? "PDF" : "Text",
        "processing",
        key,
        file.size,
        now(),
      ).run();
      try {
        await bucket.put(key, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: /\.pdf$/i.test(name)
              ? "application/pdf"
              : "text/plain; charset=utf-8",
          },
        });
        const pages = await extract(file);
        await addSource(db, mid, pages);
        const t = {
          id: mid,
          name: name.replace(/\.[^.]+$/, ""),
          page: 1,
          prereq: "Read the source",
          text: pages[0].slice(0, 2000),
          example:
            "Use the tutor or a source-backed quiz to explore this material.",
          materialId: mid,
          sourceTitle: name,
        };
        await db.batch([
          stmt(
            db,
            "UPDATE materials SET status=?,pages=? WHERE id=?",
            "ready",
            pages.length,
            mid,
          ),
          stmt(
            db,
            "INSERT INTO topics(id,owner_id,course_id,name,data,mastery,attempts,correct,last) VALUES(?,?,?,?,?,0,0,0,?)",
            mid,
            user.id,
            c.id,
            t.name,
            JSON.stringify(t),
            "Not practiced",
          ),
          stmt(
            db,
            "INSERT INTO flashcards(id,owner_id,topic_id,front,back) VALUES(?,?,?,?,?)",
            mid + "_card",
            user.id,
            mid,
            "Recall the key ideas from " + name,
            pages[0].slice(0, 1200),
          ),
          event(db, user.id, "Processed " + name),
        ]);
        return response({ id: mid, status: "ready", pages: pages.length }, 201);
      } catch (e) {
        await stmt(db, "DELETE FROM pages WHERE material_id=?", mid).run();
        await stmt(
          db,
          "UPDATE materials SET status=?,error=? WHERE id=?",
          "failed",
          e instanceof ApiError
            ? e.message
            : "Processing failed. Retry with a smaller supported file.",
          mid,
        ).run();
        if (e instanceof ApiError)
          return response(
            { error: e.message, code: e.code, materialId: mid },
            e.status,
          );
        reject(
          503,
          "processing_failed",
          "Processing failed. The failed record is saved so you can inspect or delete it.",
        );
      }
    }
    if (path[0] === "materials" && path[1]) {
      id.parse(path[1]);
      const m = await ownedMaterial(db, user.id, path[1]);
      if (method === "GET" && path[2] === "file") {
        if (m.status === "deleting")
          reject(404, "not_found", "Material not found.");
        const object = await bucket.get(m.storage_key);
        if (!object)
          reject(404, "file_missing", "The stored file is unavailable.");
        return new Response(object.body, {
          headers: {
            "Content-Type":
              m.type === "PDF"
                ? "application/pdf"
                : "text/plain; charset=utf-8",
            "Content-Disposition": `inline; filename="${m.name.replace(/[^\x20-\x7e]|["\\]/g, "_")}"`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "default-src 'none'; sandbox",
          },
        });
      }
      if (method === "GET" && path[2] === "pages") {
        const n = z.coerce
          .number()
          .int()
          .min(1)
          .max(25)
          .parse(new URL(req.url).searchParams.get("page"));
        if (m.status !== "ready")
          reject(409, "not_ready", "This material is not ready.");
        const p = await one(
          db,
          "SELECT page,text FROM pages WHERE material_id=? AND page=?",
          m.id,
          n,
        );
        if (!p) reject(404, "page_missing", "Source page not found.");
        return response({ ...p, title: m.name, materialId: m.id });
      }
      if (method === "PATCH") {
        const b = z
          .object({ name: text })
          .strict()
          .parse(await jsonBody(req));
        await stmt(
          db,
          "UPDATE materials SET name=? WHERE id=? AND owner_id=?",
          b.name,
          m.id,
          user.id,
        ).run();
        return response({ saved: true });
      }
      if (method === "DELETE") {
        await stmt(
          db,
          "UPDATE materials SET status=? WHERE id=?",
          "deleting",
          m.id,
        ).run();
        await bucket.delete(m.storage_key);
        await db.batch([
          stmt(db, "DELETE FROM pages WHERE material_id=?", m.id),
          stmt(db, "DELETE FROM quizzes WHERE material_id=?", m.id),
          stmt(
            db,
            "DELETE FROM conversations WHERE owner_id=? AND course_id=?",
            user.id,
            m.course_id,
          ),
          stmt(
            db,
            "DELETE FROM flashcards WHERE topic_id IN (SELECT id FROM topics WHERE owner_id=? AND json_extract(data,?)=?)",
            user.id,
            "$.materialId",
            m.id,
          ),
          stmt(
            db,
            "DELETE FROM topics WHERE owner_id=? AND json_extract(data,?)=?",
            user.id,
            "$.materialId",
            m.id,
          ),
          stmt(
            db,
            "UPDATE materials SET deleted_at=?,status=? WHERE id=?",
            now(),
            "deleted",
            m.id,
          ),
          event(db, user.id, "Deleted material and its learning content"),
        ]);
        return response({ deleted: true });
      }
    }
    if (path[0] === "conversations" && method === "GET") {
      const cs = await rows(
        db,
        "SELECT conv.*,c.name AS course FROM conversations conv JOIN courses c ON c.id=conv.course_id WHERE conv.owner_id=? ORDER BY conv.created_at DESC LIMIT 50",
        user.id,
      );
      const result = [];
      for (const c of cs) {
        const ms = await rows(
          db,
          "SELECT * FROM messages WHERE conversation_id=? ORDER BY created_at,rowid",
          c.id,
        );
        result.push({
          id: c.id,
          title: c.title,
          courseId: c.course_id,
          course: c.course,
          messages: ms.map((m) => ({
            id: m.id,
            role: m.role,
            text: m.text,
            ...JSON.parse(m.citations),
          })),
        });
      }
      return response(result);
    }
    if (path[0] === "conversations" && path[1] && method === "DELETE") {
      const c = await one(
        db,
        "SELECT id FROM conversations WHERE owner_id=? AND id=?",
        user.id,
        id.parse(path[1]),
      );
      if (!c) reject(404, "not_found", "Conversation not found.");
      await stmt(
        db,
        "DELETE FROM conversations WHERE id=? AND owner_id=?",
        c.id,
        user.id,
      ).run();
      return response({ deleted: true });
    }
    if (path[0] === "chat" && method === "POST") {
      const b = chatSchema.parse(await jsonBody(req));
      await rate(db, user.id, "chat", 30);
      const c = await ownedCourse(db, user.id, b.course),
        m = await ownedMaterial(db, user.id, b.materialId);
      if (m.course_id !== c.id || m.status !== "ready")
        reject(409, "not_ready", "Choose a ready material from this course.");
      let cid = b.conversationId;
      if (
        cid &&
        !(await one(
          db,
          "SELECT id FROM conversations WHERE id=? AND owner_id=? AND course_id=?",
          cid,
          user.id,
          c.id,
        ))
      )
        reject(404, "not_found", "Conversation not found in this course.");
      if (!env.GEMINI_API_KEY || !env.GEMINI_MODEL)
        reject(
          503,
          "ai_unavailable",
          "AI is unavailable until GEMINI_API_KEY and GEMINI_MODEL are configured. Your question has not been submitted to a provider.",
        );
      const passages = retrieve(
        b.question,
        await evidence(db, user.id, c.id, m.id),
      );
      let answer = "I could not find support for that in your materials",
        refs: Evidence[] = [],
        support = "none";
      if (passages.length) {
        const out = z
          .object({
            answer: z.string().min(1).max(10000),
            supported: z.boolean(),
            citations: z.array(citationInput).max(6),
          })
          .parse(
            await generate(
              env,
              JSON.stringify({
                task: 'Answer the student in the requested style. If not supported, return supported:false, answer:"I could not find support for that in your materials", citations:[]. If supported, every material claim must have an exact supporting quote and source id. Output {answer,supported,citations:[{id,quote}]}.',
                question: b.question,
                style: b.style,
                sources: passages,
              }),
            ),
          );
        if (out.supported) {
          if (!out.citations.length)
            reject(
              502,
              "missing_evidence",
              "The answer did not include verifiable evidence. Retry.",
            );
          refs = verifyCitations(out.citations, passages);
          answer = out.answer;
          support = "supported";
        }
      }
      const messageId = uuid();
      const sqls: D1PreparedStatement[] = [];
      if (!cid) {
        cid = uuid();
        sqls.push(
          stmt(
            db,
            "INSERT INTO conversations(id,owner_id,course_id,title,created_at) VALUES(?,?,?,?,?)",
            cid,
            user.id,
            c.id,
            b.question.slice(0, 80),
            now(),
          ),
        );
      }
      sqls.push(
        stmt(
          db,
          "INSERT INTO messages(id,conversation_id,role,text,citations,created_at) VALUES(?,?,?,?,?,?)",
          uuid(),
          cid,
          "student",
          b.question,
          "{}",
          now(),
        ),
        stmt(
          db,
          "INSERT INTO messages(id,conversation_id,role,text,citations,created_at) VALUES(?,?,?,?,?,?)",
          messageId,
          cid,
          "tutor",
          answer,
          JSON.stringify({ evidence: support, sources: refs }),
          now(),
        ),
        event(db, user.id, "Asked a source-grounded tutor question"),
      );
      await db.batch(sqls);
      return response({
        conversationId: cid,
        id: messageId,
        role: "tutor",
        text: answer,
        evidence: support,
        sources: refs,
      });
    }
    if (path[0] === "quizzes" && path.length === 1 && method === "POST") {
      const b = z
        .object({
          course: text,
          materialId: id,
          topic: z.string().max(160),
          type: z.enum(["Mixed", "MCQ", "Short answer", "Numerical"]),
          difficulty: z.enum(["Adaptive", "Easy", "Medium"]),
          count: z.number().int().min(1).max(10),
          mode: z.enum(["Practice quiz", "Mock exam"]),
          source: z.enum(["prepared", "ai"]),
        })
        .strict()
        .parse(await jsonBody(req));
      await rate(db, user.id, "quiz", 20);
      const c = await ownedCourse(db, user.id, b.course),
        m = await ownedMaterial(db, user.id, b.materialId);
      if (m.course_id !== c.id || m.status !== "ready")
        reject(409, "not_ready", "Choose a ready material from this course.");
      const ts = await rows(
        db,
        "SELECT * FROM topics WHERE owner_id=? AND course_id=?",
        user.id,
        c.id,
      );
      let qs: any[] = [],
        verification = "Prepared source-linked answer key",
        repeated = false;
      if (b.source === "prepared") {
        if (!m.seeded)
          reject(
            409,
            "prepared_only",
            "Prepared questions are available only for DBMS learning notes. Choose AI generation for your own material.",
          );
        const previous = await rows(
          db,
          "SELECT a.data FROM attempts a JOIN quizzes q ON q.id=a.quiz_id WHERE a.owner_id=? AND q.material_id=? ORDER BY a.created_at DESC LIMIT 50",
          user.id,
          m.id,
        );
        const seen = previous.flatMap((a) =>
          JSON.parse(a.data).questions.map((q: any) => q.bankId),
        );
        const selected = selectQuestions(
          b.topic,
          b.type,
          b.difficulty,
          b.count,
          seen,
        );
        if (!selected.length)
          reject(
            422,
            "no_questions",
            "No prepared questions match these filters.",
          );
        repeated = selected.some((q) => seen.includes(q.id));
        qs = selected.map((q) => ({
          ...q,
          bankId: q.id,
          id: uuid(),
          materialId: m.id,
          sourceTitle: m.name,
        }));
      } else {
        const passages = await evidence(db, user.id, c.id, m.id);
        if (!passages.length)
          reject(
            409,
            "no_evidence",
            "There is no extracted text for this material.",
          );
        const chosenTopic = ts.find(
          (t) =>
            JSON.parse(t.data).id === b.topic &&
            JSON.parse(t.data).materialId === m.id,
        );
        if (b.topic !== "all" && !chosenTopic)
          reject(
            422,
            "topic_scope",
            "Select a topic belonging to this material.",
          );
        const documentTopic = chosenTopic && !m.seeded && ["PDF", "Text"].includes(m.type);
        let subset = chosenTopic && !documentTopic
          ? passages.filter(p => p.page === JSON.parse(chosenTopic.data).page)
          : passages;
        if (subset.length > 12) subset = Array.from({length:12}, (_,i) => subset[Math.round(i * (subset.length - 1) / 11)]);
        const catalog = subset.flatMap(source => {
          const result = [];
          for (let offset = 0, ordinal = 0; offset < source.text.length; offset += 900, ordinal++) {
            const quote = source.text.slice(offset, offset + 900).trim();
            if (quote.length >= 5) result.push({id: ordinal ? `${source.id}_excerpt_${ordinal}` : source.id, sourceId:source.id, page:source.page, text:quote});
          }
          return result;
        });
        if (!catalog.length) reject(409, "no_evidence", "This material does not contain enough readable text for a quiz.");
        const schema = quizOutputSchema(b.count, b.type, b.difficulty);
        Object.assign(schema.properties.questions.items.properties.citation, {
          required:["id"], additionalProperties:false,
          properties:{id:{type:"string",enum:catalog.map(entry=>entry.id)}},
        });
        const raw: any = await generate(env, JSON.stringify({
          task: "Generate a quiz using only these source excerpts. MCQ answers must exactly match an option. Numerical answers must be finite number strings. No duplicates. Each citation selects a supplied excerpt ID; do not generate quotes. The server will attach exact source text.",
          count:b.count, type:b.type, difficulty:b.difficulty,
          sources:catalog.map(({id,page,text})=>({id,page,text})),
          rules:"Use only the requested types and difficulties. For non-MCQ questions use options:[]; aliases:[] when none. Do not use True/False as a type.",
        }), schema);
        if (Array.isArray(raw?.questions)) for (const q of raw.questions) {
          const entry = catalog.find(entry => entry.id === q?.citation?.id);
          if (!entry) reject(502,"invalid_citation","The generated source reference could not be verified. Please retry.");
          q.citation = {id:entry.sourceId,quote:q.citation.quote ?? entry.text};
        }
        const generated = z.object({questions:z.array(questionSchema).min(1).max(10)}).parse(raw);
        if (generated.questions.length !== b.count)
          reject(
            502,
            "question_count",
            "The AI generated an unexpected question count. Retry.",
          );
        for (const q of generated.questions) {
          if (q.type !== "MCQ") delete q.options;
          if (b.type !== "Mixed" && q.type !== b.type)
            reject(
              502,
              "question_type",
              "The AI question type did not match the requested scope.",
            );
          if (b.difficulty !== "Adaptive" && q.difficulty !== b.difficulty)
            reject(
              502,
              "difficulty",
              "The AI difficulty did not match the request.",
            );
          if (
            q.type === "MCQ" &&
            (!q.options?.includes(q.answer) ||
              new Set(q.options).size !== q.options.length)
          )
            reject(
              502,
              "invalid_key",
              "The AI answer key could not be validated.",
            );
          if (q.type === "Numerical" && !Number.isFinite(Number(q.answer)))
            reject(502, "invalid_key", "The AI numerical key is invalid.");
          const ref = verifyCitations([q.citation], subset)[0];
          qs.push({
            ...q,
            id: uuid(),
            topic:
              JSON.parse(
                (
                  chosenTopic ||
                  ts.find(
                    (t) =>
                      JSON.parse(t.data).materialId === m.id &&
                      JSON.parse(t.data).page === ref.page,
                  ) ||
                  ts.find((t) => JSON.parse(t.data).materialId === m.id)
                )?.data || "{}",
              ).id || m.id,
            page: ref.page,
            materialId: m.id,
            sourceTitle: m.name,
          });
        }
        if (new Set(qs.map((q) => q.prompt.toLowerCase())).size !== qs.length)
          reject(
            502,
            "duplicates",
            "Duplicate questions were generated. Retry.",
          );
        verification =
          "AI generated; schema and source quote checked, answer correctness not independently verified";
      }
      const qid = uuid(),
        expires =
          b.mode === "Mock exam"
            ? new Date(Date.now() + 600000).toISOString()
            : null;
      const sqls = [
        stmt(
          db,
          "INSERT INTO quizzes(id,owner_id,course_id,material_id,mode,verification,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
          qid,
          user.id,
          c.id,
          m.id,
          b.mode,
          verification,
          now(),
          expires,
        ),
      ];
      for (let i = 0; i < qs.length; i++) {
        const t =
          ts.find((t) => JSON.parse(t.data).id === qs[i].topic) ||
          ts.find((t) => JSON.parse(t.data).materialId === m.id);
        if (!t)
          reject(409, "topic_missing", "No topic exists for this source.");
        sqls.push(
          stmt(
            db,
            "INSERT INTO questions(id,quiz_id,topic_id,ordinal,data) VALUES(?,?,?,?,?)",
            qs[i].id,
            qid,
            t.id,
            i,
            JSON.stringify(qs[i]),
          ),
        );
      }
      await db.batch(sqls);
      return response(
        {
          id: qid,
          questions: qs.map(
            ({ answer, aliases, explanation, citation, ...q }) => q,
          ),
          verification,
          repeated,
          expiresAt: expires,
        },
        201,
      );
    }
    if (
      path[0] === "quizzes" &&
      path[1] &&
      path[2] === "submit" &&
      method === "POST"
    ) {
      const qid = id.parse(path[1]),
        b = z
          .object({ answers: z.record(z.string().max(1000)) })
          .strict()
          .parse(await jsonBody(req));
      const quiz = await one(
        db,
        "SELECT * FROM quizzes WHERE id=? AND owner_id=?",
        qid,
        user.id,
      );
      if (!quiz) reject(404, "not_found", "Quiz not found.");
      const prior = await one(
        db,
        "SELECT data FROM attempts WHERE quiz_id=? AND owner_id=?",
        qid,
        user.id,
      );
      if (prior) return response(JSON.parse(prior.data));
      const records = await rows(
        db,
        "SELECT * FROM questions WHERE quiz_id=? ORDER BY ordinal",
        qid,
      );
      const qs = records.map((q) => JSON.parse(q.data));
      if (Object.keys(b.answers).some((k) => !qs.some((q) => q.id === k)))
        reject(
          400,
          "unknown_question",
          "An answer refers to a question outside this assessment.",
        );
      const expired =
        quiz.expires_at &&
        Date.now() > new Date(quiz.expires_at).getTime() + 30000;
      if (expired)
        reject(
          409,
          "exam_expired",
          "The mock exam submission window has expired. Start a new assessment.",
        );
      const results = qs.map((q) => grade(q, b.answers[q.id] || ""));
      const aid = uuid(),
        date = now(),
        score = Math.round((results.filter(Boolean).length / qs.length) * 100),
        attempt = {
          id: aid,
          quizId: qid,
          date,
          questions: qs,
          answers: b.answers,
          results,
          score,
        };
      const sqls = [
        stmt(
          db,
          "INSERT INTO attempts(id,quiz_id,owner_id,score,data,created_at) VALUES(?,?,?,?,?,?)",
          aid,
          qid,
          user.id,
          score,
          JSON.stringify(attempt),
          date,
        ),
      ];
      for (const tid of new Set(records.map((q) => q.topic_id))) {
        const indices = records
            .map((q, i) => (q.topic_id === tid ? i : -1))
            .filter((i) => i >= 0),
          correct = indices.filter((i) => results[i]).length,
          accuracy = (correct / indices.length) * 100;
        sqls.push(
          stmt(
            db,
            "UPDATE topics SET mastery=CAST(ROUND(0.7*mastery+0.3*?) AS INTEGER),attempts=attempts+?,correct=correct+?,last=? WHERE id=? AND owner_id=?",
            accuracy,
            indices.length,
            correct,
            date,
            tid,
            user.id,
          ),
        );
        sqls.push(
          stmt(
            db,
            "INSERT INTO mastery_history(id,owner_id,topic_id,attempt_id,mastery,created_at) SELECT ?,owner_id,id,?,mastery,? FROM topics WHERE id=? AND owner_id=?",
            uuid(),
            aid,
            date,
            tid,
            user.id,
          ),
        );
      }
      sqls.push(event(db, user.id, "Completed a quiz · " + score + "%"));
      try {
        await db.batch(sqls);
      } catch (e) {
        const saved = await one(
          db,
          "SELECT data FROM attempts WHERE quiz_id=? AND owner_id=?",
          qid,
          user.id,
        );
        if (saved) return response(JSON.parse(saved.data));
        throw e;
      }
      return response(attempt);
    }
    if (path[0] === "revision" && method === "POST") {
      const b = z
        .object({ topic: id })
        .strict()
        .parse(await jsonBody(req));
      const t = await one(
        db,
        "SELECT id FROM topics WHERE owner_id=? AND (id=? OR json_extract(data,?)=?)",
        user.id,
        b.topic,
        "$.id",
        b.topic,
      );
      if (!t) reject(404, "not_found", "Topic not found.");
      await db.batch([
        stmt(
          db,
          "INSERT INTO revisions(id,owner_id,topic_id,created_at) VALUES(?,?,?,?)",
          uuid(),
          user.id,
          t.id,
          now(),
        ),
        event(db, user.id, "Reviewed a flashcard"),
      ]);
      return response({ saved: true });
    }
    if (path[0] === "flashcards" && method === "GET")
      return response(
        await rows(
          db,
          "SELECT f.id,f.front,f.back,t.data FROM flashcards f JOIN topics t ON t.id=f.topic_id WHERE f.owner_id=?",
          user.id,
        ),
      );
    reject(404, "route_not_found", "This API operation is not available.");
  } catch (e) {
    if (e instanceof ApiError)
      return response({ error: e.message, code: e.code }, e.status);
    if (e instanceof z.ZodError)
      return response(
        {
          error:
            "Some request or provider fields are invalid. Check the input and retry.",
          code: "validation",
        },
        400,
      );
    return response(
      {
        error:
          "The service could not complete this operation. Your existing saved records remain available. Please retry.",
        code: "service_error",
      },
      503,
    );
  }
}
