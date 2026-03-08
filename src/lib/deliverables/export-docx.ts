import "server-only";
import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  TextRun,
  type IParagraphOptions
} from "docx";
import { createTaskOutputStoragePath } from "@/src/lib/storage/task-output-files";
import { saveTaskArtifact } from "@/src/lib/storage/task-artifacts";
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
  const body = await buildDocxBuffer(payload);

  const artifact = await saveTaskArtifact({
    storagePath,
    body,
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
}

async function buildDocxBuffer(payload: ReturnType<typeof prepareDocxExportPayload>) {
  const children: Paragraph[] = [];

  children.push(
    paragraphWithRuns(
      [
        new TextRun({
          text: payload.title,
          bold: true,
          size: 28,
          font: docxFontOptions()
        })
      ],
      {
        alignment: AlignmentType.CENTER,
        spacing: {
          after: 240
        }
      }
    )
  );

  for (const section of payload.sections) {
    children.push(
      paragraphWithRuns(
        [
          new TextRun({
            text: section.heading,
            bold: true,
            size: 24,
            font: docxFontOptions()
          })
        ],
        {
          spacing: {
            before: 120,
            after: 160
          }
        }
      )
    );

    for (const text of section.paragraphs) {
      children.push(
        paragraphWithRuns(
          [
            new TextRun({
              text,
              size: 24,
              font: docxFontOptions()
            })
          ],
          {
            spacing: {
              after: 200
            }
          }
        )
      );
    }
  }

  children.push(
    paragraphWithRuns(
      [
        new TextRun({
          text: "References",
          bold: true,
          size: 24,
          font: docxFontOptions()
        })
      ],
      {
        spacing: {
          before: 160,
          after: 160
        }
      }
    )
  );

  for (const reference of payload.references) {
    children.push(
      paragraphWithRuns(
        [
          new TextRun({
            text: reference,
            size: 24,
            font: docxFontOptions()
          })
        ],
        {
          indent: {
            left: 480,
            hanging: 480
          },
          spacing: {
            after: 160
          }
        }
      )
    );
  }

  const document = new Document({
    sections: [
      {
        children
      }
    ]
  });

  return Packer.toBuffer(document);
}

function paragraphWithRuns(runs: TextRun[], options: Omit<IParagraphOptions, "children"> = {}) {
  return new Paragraph({
    ...options,
    children: runs
  });
}

function docxFontOptions() {
  return {
    ascii: "Times New Roman",
    hAnsi: "Times New Roman",
    cs: "Times New Roman",
    eastAsia: "SimSun"
  };
}
