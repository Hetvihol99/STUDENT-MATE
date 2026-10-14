import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
process.argv.push("--check");
const {origin, localData, stop} = await import("./dev-local.mjs");
let cookie = "";
async function call(p, method = "GET", body, extra = {}) {
  const form = body instanceof FormData;
  const r = await fetch(origin + p, {
    method, redirect: "manual",
    headers: {Origin: origin, "X-StudyMate-Request": "1", Cookie: cookie, ...(body !== undefined && !form ? {"Content-Type": "application/json"} : {}), ...extra},
    body: body === undefined ? undefined : form ? body : JSON.stringify(body), signal: AbortSignal.timeout(20000),
  });
  return {r, data: r.headers.get("content-type")?.includes("json") ? await r.json() : await r.text()};
}
try {
  assert.equal((await call("/api/study/state")).r.status, 401);
  assert.equal((await call("/api/study/state", "GET", undefined, {"X-Dev-User-Id": "forged", Cookie: "__studymate_local=1"})).r.status, 401);
  assert.equal((await call("/api/study/auth/config")).data.provider, "password");
  assert.equal((await call("/signin-with-chatgpt")).r.headers.get("set-cookie"), null);
  const registered = await call("/api/study/auth/register", "POST", {email: "qa@example.test", name: "QA Student", password: "A disposable test passphrase 123"});
  assert.equal(registered.r.status, 201, JSON.stringify(registered.data));
  cookie = registered.r.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("/api/study/bootstrap", "POST", {})).r.status, 200);
  assert.equal((await call("/api/study/courses", "POST", {name: "attack"}, {Origin: "https://evil.test"})).r.status, 403);
  assert.match((await call("/")).data, /local\/main.tsx/);
  assert.equal((await call("/local/main.tsx")).r.status, 200);
  assert.equal((await call("/app/page.tsx")).r.status, 200);
  await call("/api/study/seed", "POST", {});
  let state = (await call("/api/study/state")).data;
  assert.equal(state.materials.length, 1);
  assert.equal((await call(state.materials[0].url)).r.status, 200);
  const made = await call("/api/study/quizzes", "POST", {course: "DBMS Unit 1", materialId: state.materials[0].id, topic: "keys", type: "Mixed", difficulty: "Adaptive", count: 3, mode: "Practice quiz", source: "prepared"});
  assert.equal(made.r.status, 201, JSON.stringify(made.data));
  assert.ok(made.data.questions.every(q => !("answer" in q)));
  const result = await call("/api/study/quizzes/" + made.data.id + "/submit", "POST", {answers: {}});
  assert.equal(result.r.status, 200);
  assert.equal(result.data.score, 0);
  assert.equal((await call("/api/study/quizzes/" + made.data.id + "/submit", "POST", {answers: {}})).data.id, result.data.id);
  await call("/api/study/revision", "POST", {topic: "keys"});
  const form = new FormData();
  form.set("course", "DBMS Unit 1");
  form.set("file", new File([readFileSync(new URL("../sample-materials/DBMS-Unit-1.pdf", import.meta.url))], "upload.pdf", {type: "application/pdf"}));
  const upload = await call("/api/study/materials", "POST", form);
  assert.equal(upload.r.status, 201, JSON.stringify(upload.data));
  assert.equal(upload.data.pages, 4);
  assert.match((await call("/api/study/materials/" + upload.data.id + "/pages?page=2")).data.text, /primary key/i);
  assert.equal((await call("/api/study/materials/" + upload.data.id, "DELETE")).r.status, 200);
  assert.equal((await call("/api/study/chat", "POST", {course: "DBMS Unit 1", materialId: state.materials[0].id, question: "What is a key?", style: "Simple"})).data.code, "ai_unavailable");
  const youtube = await call("/api/study/materials/youtube", "POST", {course:"DBMS Unit 1",url:"https://youtu.be/abcdefghijk",name:"Transcript lesson",transcript:"A primary key uniquely identifies a row."});
  assert.equal(youtube.r.status,201,JSON.stringify(youtube.data));
  assert.equal((await call(`/api/study/materials/${youtube.data.id}/pages?page=1`)).data.type,"YouTube");
  const media = new FormData(); media.set("course","DBMS Unit 1"); media.set("transcript","A primary key uniquely identifies a row.");
  media.set("file",new File([new Uint8Array([0,0,0,24,102,116,121,112,105,115,111,109])],"lesson.mp4",{type:"video/mp4"}));
  const video = await call("/api/study/materials","POST",media);
  assert.equal(video.r.status,201,JSON.stringify(video.data));
  const range = await fetch(origin + `/api/study/materials/${video.data.id}/file`,{headers:{Cookie:cookie,Range:"bytes=0-3"}});
  assert.equal(range.status,206);
  assert.equal((await call(`/api/study/materials/${video.data.id}`,"DELETE")).r.status,200);
  const previous = cookie;
  await call("/api/study/auth/logout", "POST");
  assert.equal((await call("/api/study/state")).r.status, 401);
  cookie = "";
  const login = await call("/api/study/auth/login", "POST", {email: "qa@example.test", password: "A disposable test passphrase 123"});
  assert.equal(login.r.status, 200);
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  assert.notEqual(cookie, previous);
  state = (await call("/api/study/state")).data;
  assert.equal(state.attempts.length, 1);
  assert.ok(state.reviewed.includes("keys"));
  console.log("PASS: frontend/Python proxy, real account registration and login, forged-cookie rejection, CSRF, sample downloads, quizzes, idempotent grading, revision, PDF upload, video/YouTube imports, video ranges, deletion, logout revocation and persistent account data.");
} finally {
  await stop();
  // The subprocess must release SQLite before removing the disposable fixture.
  await new Promise(resolve => setTimeout(resolve, 300));
  rmSync(localData, {recursive: true, force: true});
}
