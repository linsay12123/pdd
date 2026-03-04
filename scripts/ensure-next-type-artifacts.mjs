import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const requiredFiles = [
  ".next/types/cache-life.d.ts",
  ".next/dev/types/cache-life.d.ts"
];

for (const relativePath of requiredFiles) {
  const absolutePath = resolve(process.cwd(), relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, "export {};\n", { flag: "a" });
}

await Promise.all(
  ["tsconfig.tsbuildinfo", ".next/cache/.tsbuildinfo"].map((relativePath) =>
    rm(resolve(process.cwd(), relativePath), { force: true })
  )
);
