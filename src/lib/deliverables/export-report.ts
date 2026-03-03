import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  createTaskOutputStoragePath,
  resolveStoredFileDiskPath
} from "@/src/lib/storage/task-output-files";
import { saveTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { saveTaskOutput } from "@/src/lib/tasks/task-output-store";

export type ReferenceReportEntry = {
  rawReference: string;
  verdictLabel: string;
  reasoning: string;
};

export type ReferenceReportInput = {
  taskId: string;
  userId: string;
  reportId: string;
  createdAt: string;
  taskSummary: {
    targetWordCount: number;
    citationStyle: string;
  };
  entries: ReferenceReportEntry[];
  closingSummary: string;
};

export function resolveReferenceReportOutputPath(userId: string, taskId: string) {
  return resolveStoredFileDiskPath(
    createTaskOutputStoragePath(
      userId,
      taskId,
      "reference-report.pdf"
    )
  );
}

export function prepareReferenceReportPayload(input: ReferenceReportInput) {
  if (!input.entries.length) {
    throw new Error("Reference report export requires at least one report row");
  }

  return input;
}

export async function exportReferenceReport(input: ReferenceReportInput) {
  const payload = prepareReferenceReportPayload(input);
  const storagePath = createTaskOutputStoragePath(
    input.userId,
    input.taskId,
    "reference-report.pdf"
  );
  const tempOutputPath = resolveStoredFileDiskPath(storagePath);
  const tempDir = path.join(process.cwd(), "tmp", "pdfs");
  const payloadPath = path.join(tempDir, `${input.taskId}-reference-report.json`);

  await mkdir(tempDir, { recursive: true });
  await mkdir(path.dirname(tempOutputPath), { recursive: true });
  await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

  await runPythonWorker(
    path.join(process.cwd(), "workers", "pdfs", "export_reference_report.py"),
    [payloadPath, tempOutputPath]
  );

  const artifact = await saveTaskArtifact({
    storagePath,
    body: await readFile(tempOutputPath),
    contentType: "application/pdf"
  });

  await saveTaskOutput({
    taskId: input.taskId,
    userId: input.userId,
    outputKind: "reference_report_pdf",
    storagePath
  });

  return {
    outputPath: artifact.outputPath,
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
