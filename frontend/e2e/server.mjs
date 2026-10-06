// Starts the app for the end-to-end tests: the real backend serving the
// built frontend (`npm run build` first), on a fresh database in e2e/.data
// (git-ignored, wiped at each start) so the tests never touch a real one.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";

const port = process.argv[2] ?? "8799";
const backend = resolve(import.meta.dirname, "..", "..", "backend");
const venv = process.platform === "win32" ? join(backend, ".venv", "Scripts", "python.exe") : join(backend, ".venv", "bin", "python");
const python = process.env.PYTHON ?? (existsSync(venv) ? venv : "python");
// Wiped at the start rather than the end: the server is killed when the tests finish.
const dataDir = join(import.meta.dirname, ".data");
rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir);

const app = spawn(python, [join(backend, "app.py"), "--no-browser", "--no-tray", "--port", port, "--data-dir", dataDir], {
  cwd: backend,
  stdio: "inherit",
});
const stop = () => app.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", (code) => process.exit(code ?? 0));
