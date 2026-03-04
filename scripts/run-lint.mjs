import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.cwd();

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }

  if (result.error) {
    throw result.error;
  }
}

run("npx", ["next", "typegen"]);
run(process.execPath, [resolve(root, "scripts/ensure-next-type-artifacts.mjs")]);
run("corepack", ["pnpm", "exec", "tsc", "--noEmit"]);
