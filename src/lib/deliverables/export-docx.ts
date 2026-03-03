import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createTaskOutputStoragePath, resolveStoredFileDiskPath } from "@/src/lib/storage/task-output-files";
import { saveTaskOutput } from "@/src/lib/tasks/task-output-store";
import type { TaskOutputKind } from "@/src/types/tasks";

export type DocxSection = {
  heading: string;
  paragraphs: string[];
};

export type DocxExportInput = {
  taskId: string;
  userId: string;
  title: string;
  sections: DocxSection[];
  references: string[];
  citationStyle: string;
  variant?: "final" | "humanized";
  outputKind?: TaskOutputKind;
};

export function resolveDocxOutputPath(
  userId: string,
  taskId: string,
  variant: "final" | "humanized" = "final"
) {
  return resolveStoredFileDiskPath(
    createTaskOutputStoragePath(userId, taskId, `${variant}.docx`)
  );
}

export function prepareDocxExportPayload(input: DocxExportInput) {
  if (!input.title.trim() || !input.references.length) {
    throw new Error("DOCX export requires a title and at least one reference");
  }

  return {
    ...input,
    title: input.title.trim()
  };
}

export async function exportDocx(input: DocxExportInput) {
  const payload = prepareDocxExportPayload(input);
  const variant = input.variant ?? "final";
  const storagePath = createTaskOutputStoragePath(input.userId, input.taskId, `${variant}.docx`);
  const outputPath = resolveStoredFileDiskPath(storagePath);
  const tempDir = path.join(process.cwd(), "tmp", "docs");
  const payloadPath = path.join(tempDir, `${input.taskId}-docx-payload.json`);

  await mkdir(tempDir, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

  await runPythonWorker(
    path.join(process.cwd(), "workers", "docs", "export_docx.py"),
    [payloadPath, outputPath]
  );

  await saveTaskOutput({
    taskId: input.taskId,
    userId: input.userId,
    outputKind:
      input.outputKind ?? (variant === "humanized" ? "humanized_docx" : "final_docx"),
    storagePath
  });

  return {
    outputPath,
    payloadPath,
    storagePath
  };
}

function runPythonWorker(scriptPath: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: "inherit"
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Python worker failed with exit code ${code ?? -1}`));
    });
  });
}
