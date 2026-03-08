import PDFDocument from "pdfkit";
import { createTaskOutputStoragePath } from "@/src/lib/storage/task-output-files";
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

  await saveTaskOutput({
    taskId: input.taskId,
    userId: input.userId,
    outputKind: "reference_report_pdf",
    storagePath
  });

  return {
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
  document.font("Times-Roman").fontSize(20).text("Reference Verification Report", {
    align: "center"
  });
  document.moveDown(1);
  document.fontSize(11).text(`Report ID: ${payload.reportId}`);
  document.text(`Created At: ${payload.createdAt}`);
  document.text(`Target Word Count: ${payload.taskSummary.targetWordCount}`);
  document.text(`Citation Style: ${payload.taskSummary.citationStyle}`);
  document.moveDown(1);
}

function writeEntries(document: PDFKit.PDFDocument, entries: ReferenceReportEntry[]) {
  entries.forEach((entry, index) => {
    if (index > 0) {
      document.moveDown(0.5);
    }

    document.font("Times-Bold").fontSize(13).text(`Reference ${index + 1}`);
    document.font("Times-Roman").fontSize(11).text(`Reference: ${entry.rawReference}`);
    document.text(`Verdict: ${translateVerdictLabel(entry.verdictLabel)}`);
    document.text(`Reasoning: ${entry.reasoning}`);
  });
}

function writeClosingSummary(document: PDFKit.PDFDocument, closingSummary: string) {
  document.moveDown(1);
  document.font("Times-Bold").fontSize(13).text("Closing Summary");
  document.font("Times-Roman").fontSize(11).text(closingSummary);
}

function translateVerdictLabel(label: string) {
  if (label === "基本可对应") {
    return "Basically matching";
  }

  if (label === "有风险") {
    return "Risky";
  }

  return label;
}
