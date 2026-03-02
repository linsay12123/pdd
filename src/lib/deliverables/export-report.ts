import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { saveTaskOutputRecord } from "@/src/lib/tasks/repository";

export type ReferenceReportEntry = {
  rawReference: string;
  verdictLabel: string;
  reasoning: string;
};

export type ReferenceReportInput = {
  taskId: string;
  reportId: string;
  createdAt: string;
  taskSummary: {
    targetWordCount: number;
    citationStyle: string;
  };
  entries: ReferenceReportEntry[];
  closingSummary: string;
};

export function resolveReferenceReportOutputPath(taskId: string) {
  return path.join(
    process.cwd(),
    "output",
    "pdf",
    `${taskId}-reference-report.pdf`
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
  const outputPath = resolveReferenceReportOutputPath(input.taskId);
  const tempDir = path.join(process.cwd(), "tmp", "pdfs");
  const payloadPath = path.join(tempDir, `${input.taskId}-reference-report.json`);

  await mkdir(tempDir, { recursive: true });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(payloadPath, JSON.stringify(payload, null, 2), "utf8");

  await runPythonWorker(
    path.join(process.cwd(), "workers", "pdfs", "export_reference_report.py"),
    [payloadPath, outputPath]
  );

  saveTaskOutputRecord({
    taskId: input.taskId,
    outputKind: "reference_report_pdf",
    storagePath: outputPath
  });

  return {
    outputPath,
    payloadPath
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
