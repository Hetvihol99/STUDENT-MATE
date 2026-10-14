import "./windows-fs-compat.mjs";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const backendRoot = path.resolve(root, "../backend");
const checking = process.argv.includes("--check");
const localData = checking ? mkdtempSync(path.join(tmpdir(), "studymate-check-")) : path.join(backendRoot, ".local-data");
const python = process.env.STUDYMATE_PYTHON || path.join(backendRoot, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) throw new Error("Python environment is missing. Follow backend/README.md before starting the app.");
const backendPort = await new Promise((resolve, reject) => {
  const socket = createNetServer();
  socket.on("error", reject);
  socket.listen(0, "127.0.0.1", () => {
    const port = socket.address().port;
    socket.close(() => resolve(port));
  });
});
const backendOrigin = "http://127.0.0.1:" + backendPort;
const backend = spawn(python, ["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", String(backendPort), "--no-access-log"], {
  cwd: backendRoot,
  env: {
    ...process.env,
    AUTH_MODE: "session",
    APP_ENV: "development",
    ...(checking ? {DATABASE_PATH: path.join(localData, "test.db"), STORAGE_PATH: path.join(localData, "files"), GEMINI_API_KEY: ""} : {}),
  },
  stdio: ["ignore", "inherit", "inherit"],
});
let spawnError;
backend.on("error", (error) => { spawnError = error; });
let ready = false;
for (let attempt = 0; attempt < 100; attempt++) {
  if (spawnError || backend.exitCode !== null) break;
  try {
    ready = (await fetch(backendOrigin + "/ready", {signal: AbortSignal.timeout(500)})).ok;
    if (ready) break;
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 100));
}
if (!ready) {
  backend.kill();
  throw spawnError || new Error("Python backend could not start. Install backend/requirements.txt and retry.");
}
const port = Number(process.env.STUDYMATE_PORT || (checking ? 5174 : 5173));
const origin = "http://127.0.0.1:" + port;
const server = await createServer({
  configFile: false,
  root,
  publicDir: path.join(root, "public"),
  resolve: {alias: {"@": root}},
  plugins: [react(), {
    name: "study-account-frontend",
    configureServer(vite) {
      vite.middlewares.use(async (req, res, next) => {
        try {
          if (!["127.0.0.1", "::ffff:127.0.0.1", "::1"].includes(req.socket.remoteAddress) || req.headers.host !== "127.0.0.1:" + port) {
            res.writeHead(403);
            res.end("Use the printed loopback URL to open this local app.");
            return;
          }
          const url = new URL(req.url, origin);
          if (["/signin-with-chatgpt", "/signout-with-chatgpt"].includes(url.pathname)) {
            res.writeHead(302, {Location: "/#signin", "Cache-Control": "no-store"});
            res.end();
            return;
          }
          if (url.pathname === "/" || url.pathname === "/index.html") {
            const html = await vite.transformIndexHtml(req.url, readFileSync(path.join(root, "local/index.html"), "utf8"));
            res.writeHead(200, {"Content-Type": "text/html", "Cache-Control": "no-store"});
            res.end(html);
            return;
          }
          next();
        } catch {
          res.writeHead(503, {"Content-Type": "application/json"});
          res.end(JSON.stringify({error: "Unable to open the app. Restart the local server.", code: "local_failure"}));
        }
      });
    },
  }],
  server: {host: "127.0.0.1", port, strictPort: true, fs: {allow: [root]}, proxy: {
    "/api/study": {target: backendOrigin, changeOrigin: false},
  }},
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await server.close();
  backend.kill();
}
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
process.once("exit", () => backend.kill());
backend.on("exit", () => { if (!stopping) server.close(); });
try { await server.listen(); } catch (error) { await stop(); throw error; }
console.log("StudyMate: " + origin + " — real accounts; Python SQLite database and private file storage.");
export {server, backend, localData, origin, stop};
