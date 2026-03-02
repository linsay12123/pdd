import { spawn } from "node:child_process";
import http from "node:http";

const baseUrl = "http://127.0.0.1:3000";
const nextArgs = [
  "./node_modules/next/dist/bin/next",
  "dev",
  "--hostname",
  "127.0.0.1",
  "--port",
  "3000"
];
const playwrightArgs = [
  "./node_modules/@playwright/test/cli.js",
  "test",
  ...process.argv.slice(2)
];

const server = spawn("node", nextArgs, {
  cwd: process.cwd(),
  stdio: "inherit"
});

let shuttingDown = false;

const shutdownServer = () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (!server.killed) {
    server.kill("SIGTERM");
  }
};

process.on("SIGINT", () => {
  shutdownServer();
  process.exit(130);
});

process.on("SIGTERM", () => {
  shutdownServer();
  process.exit(143);
});

server.on("exit", (code) => {
  if (!shuttingDown && code !== 0) {
    process.exit(code ?? 1);
  }
});

try {
  await waitForServer(baseUrl, 120_000);
  const exitCode = await runPlaywright();
  shutdownServer();
  process.exit(exitCode);
} catch (error) {
  shutdownServer();
  console.error(
    error instanceof Error ? error.message : "E2E startup failed unexpectedly."
  );
  process.exit(1);
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn("node", playwrightArgs, {
      cwd: process.cwd(),
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      resolve(code ?? 1);
    });
  });
}

async function waitForServer(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await canReach(url)) {
      return;
    }

    await sleep(500);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

function canReach(url) {
  return new Promise((resolve) => {
    const request = http.get(url, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined);
    });

    request.on("error", () => {
      resolve(false);
    });

    request.setTimeout(1000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
