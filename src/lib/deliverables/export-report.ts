import "server-only";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { createTaskOutputStoragePath } from "@/src/lib/storage/task-output-files";
import { saveTaskArtifact } from "@/src/lib/storage/task-artifacts";
import { saveTaskOutput } from "@/src/lib/tasks/task-output-store";
import type { ReferenceVerdict } from "@/src/lib/references/verification-rules";

const NOTO_SANS_SC_REGULAR_PATH = fileURLToPath(
  new URL("../../assets/fonts/NotoSansSC-Regular.otf", import.meta.url)
);

export type ReferenceReportEntry = {
  rawReference: string;
  verdict: ReferenceVerdict;
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
  const body = await buildReferenceReportBuffer(payload);

  const artifact = await saveTaskArtifact({
    storagePath,
    body,
    contentType: "application/pdf"
  });

  const output = await saveTaskOutput({
    taskId: input.taskId,
    userId: input.userId,
    outputKind: "reference_report_pdf",
    storagePath
  });

  return {
    outputId: output.id,
    outputPath: artifact.outputPath,
    storagePath
  };
}

function buildReferenceReportBuffer(payload: ReturnType<typeof prepareReferenceReportPayload>) {
  return new Promise<Buffer>((resolve, reject) => {
    const document = new PDFDocument({
      size: "A4",
      margin: 50
    });
    const chunks: Buffer[] = [];

    document.on("data", (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    document.on("end", () => {
      resolve(Buffer.concat(chunks));
    });
    document.on("error", reject);

    document.registerFont("NotoSansSC", NOTO_SANS_SC_REGULAR_PATH);
    document.font("NotoSansSC");

    writeHeader(document, payload);
    writeEntries(document, payload.entries);
    writeClosingSummary(document, payload.closingSummary);

    document.end();
  });
}

function writeHeader(
  document: PDFKit.PDFDocument,
  payload: ReturnType<typeof prepareReferenceReportPayload>
) {
  document.font("NotoSansSC").fontSize(20).text("参考文献核验报告", {
    align: "center"
  });
  document.moveDown(1);
  document.fontSize(11).text(`报告编号：${payload.reportId}`);
  document.text(`生成时间：${payload.createdAt}`);
  document.text(`目标字数：${payload.taskSummary.targetWordCount}`);
  document.text(`引用格式：${payload.taskSummary.citationStyle}`);
  document.moveDown(1);
}

function writeEntries(document: PDFKit.PDFDocument, entries: ReferenceReportEntry[]) {
  entries.forEach((entry, index) => {
    if (index > 0) {
      document.moveDown(0.5);
    }

    document.font("NotoSansSC").fontSize(13).text(`参考文献 ${index + 1}`);
    document.font("NotoSansSC").fontSize(11).text(`参考文献：${entry.rawReference}`);
    document.text(`核验结果：${mapVerdictLabel(entry.verdict)}`);
    document.text(`理由：${entry.reasoning}`);
  });
}

function writeClosingSummary(document: PDFKit.PDFDocument, closingSummary: string) {
  document.moveDown(1);
  document.font("NotoSansSC").fontSize(13).text("总结");
  document.font("NotoSansSC").fontSize(11).text(closingSummary);
}

function mapVerdictLabel(verdict: ReferenceVerdict) {
  if (verdict === "matching") {
    return "基本可对应";
  }

  return "有风险";
}
