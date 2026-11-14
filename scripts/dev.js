const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const frontend = path.join(root, "frontend");
const backend = path.join(root, "backend");
const children = [];
let stopping = false;

function stop(code) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (!child.killed) child.kill();
  });
  process.exitCode = code;
}

function start(name, script, cwd, env = {}) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: "inherit"
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(`${name} failed to start:`, error);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${name} stopped unexpectedly.`);
      stop(code || 1);
    }
  });
}

start(
  "Frontend",
  path.join(frontend, "node_modules", "vite", "bin", "vite.js"),
  frontend
);
start(
  "Backend",
  path.join(backend, "server.js"),
  backend,
  {
    FRONTEND_URL: "http://localhost:8080",
    PORT: "5000"
  }
);

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
