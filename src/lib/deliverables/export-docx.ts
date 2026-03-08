import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createTaskOutputStoragePath } from "@/src/lib/storage/task-output-files";
import { saveTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { saveTaskOutput } from "@/src/lib/tasks/task-output-store";
import type { TaskOutputKind } from "@/src/types/tasks";
import { withRuntimeTempDir } from "@/src/lib/deliverables/runtime-temp";

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
  return withRuntimeTempDir(`pdd-docx-${input.taskId}-`, async (tempDir) => {
    const tempOutputPath = path.join(tempDir, `${variant}.docx`);
    const payloadPath = path.join(tempDir, "payload.json");

    await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

    await runPythonWorker(
      path.join(process.cwd(), "workers", "docs", "export_docx.py"),
      [payloadPath, tempOutputPath]
    );

    const artifact = await saveTaskArtifact({
      storagePath,
      body: await readFile(tempOutputPath),
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    });

    const output = await saveTaskOutput({
      taskId: input.taskId,
      userId: input.userId,
      outputKind:
        input.outputKind ?? (variant === "humanized" ? "humanized_docx" : "final_docx"),
      storagePath
    });

    return {
      outputId: output.id,
      outputPath: artifact.outputPath,
      storagePath
    };
  });
}

function runPythonWorker(scriptPath: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("python3", [scriptPath, ...args], {
      cwd: process.cwd(),
      stdio: "inherit"
    });
    let settled = false;

    const settleOnce = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    child.on("error", (error) => {
      settleOnce(() => {
        reject(
          new Error(
            `Python worker failed to start: ${error instanceof Error ? error.message : String(error)}`
          )
        );
      });
    });

    child.on("exit", (code) => {
      settleOnce(() => {
        if (code === 0) {
          resolve();
          return;
        }

        reject(new Error(`Python worker failed with exit code ${code ?? -1}`));
      });
    });
  });
}
