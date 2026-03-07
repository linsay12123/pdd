import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { requestOpenAITextResponseMock } = vi.hoisted(() => ({
  requestOpenAITextResponseMock: vi.fn()
}));

vi.mock("../../src/lib/ai/openai-client", () => ({
  requestOpenAITextResponse: requestOpenAITextResponseMock,
  safeParseJSON: (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
}));

import { analyzeUploadedTaskWithOpenAI } from "../../src/lib/ai/services/analyze-uploaded-task";

function collectStrictSchemaProblems(
  node: unknown,
  path = "schema"
): string[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  const schemaNode = node as {
    type?: string | string[];
    properties?: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
    items?: unknown;
  };

  const problems: string[] = [];
  const typeList = Array.isArray(schemaNode.type)
    ? schemaNode.type
    : schemaNode.type
      ? [schemaNode.type]
      : [];
  const isStrictObject =
    typeList.includes("object") &&
    schemaNode.additionalProperties === false &&
    schemaNode.properties &&
    typeof schemaNode.properties === "object";

  if (isStrictObject) {
    const propertyKeys = Object.keys(schemaNode.properties ?? {});
    const requiredKeys = Array.isArray(schemaNode.required) ? schemaNode.required : [];
    const missingKeys = propertyKeys.filter((key) => !requiredKeys.includes(key));
    const unexpectedKeys = requiredKeys.filter((key) => !propertyKeys.includes(key));

    if (missingKeys.length > 0) {
      problems.push(`${path} 缺少 required: ${missingKeys.join(", ")}`);
    }

    if (unexpectedKeys.length > 0) {
      problems.push(`${path} 多写了 required: ${unexpectedKeys.join(", ")}`);
    }

    for (const [key, value] of Object.entries(schemaNode.properties ?? {})) {
      problems.push(...collectStrictSchemaProblems(value, `${path}.properties.${key}`));
    }
  }

  if (schemaNode.items) {
    problems.push(...collectStrictSchemaProblems(schemaNode.items, `${path}.items`));
  }

  return problems;
}

describe("model analysis guardrails", () => {
  beforeEach(() => {
    requestOpenAITextResponseMock.mockReset();
  });

  it("uses one model call to return structured analysis and the first outline together", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The first file is the real task brief.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: ["ASEAN banking risk"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "Focus on governance.",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        },
        outline: {
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
        }
      })
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "Focus on governance.",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Write 2750 words with Harvard referencing."
        }
      ]
    });

    expect(result.analysis.targetWordCount).toBe(2750);
    expect(result.analysis.citationStyle).toBe("Harvard");
    expect(result.analysis.analysisRenderMode).toBe("structured");
    expect(result.analysis.rawModelResponse).toBeNull();
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
    expect(requestOpenAITextResponseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        maxAttempts: 1
      })
    );
  });

  it("sends a strict json schema whose every object property is also listed in required", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: "file-1",
          supportingFileIds: [],
          ignoredFileIds: [],
          needsUserConfirmation: false,
          reasoning: "The first file is the real task brief.",
          targetWordCount: 2750,
          citationStyle: "Harvard",
          topic: "Finance Risk Governance in ASEAN Banks",
          chapterCount: 6,
          mustCover: ["ASEAN banking risk"],
          gradingFocus: ["Critical analysis"],
          appliedSpecialRequirements: "Focus on governance.",
          usedDefaultWordCount: false,
          usedDefaultCitationStyle: false,
          warnings: []
        },
        outline: {
          articleTitle: "Finance Risk Governance in ASEAN Banks",
          sections: [
            {
              title: "Introduction",
              summary: "Introduce the governance problem and essay focus.",
              bulletPoints: ["Context", "Problem", "Argument"]
            }
          ]
        }
      })
    });

    await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "Focus on governance.",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Write 2750 words with Harvard referencing."
        }
      ]
    });

    const request = requestOpenAITextResponseMock.mock.calls[0]?.[0] as {
      textFormat?: {
        schema?: unknown;
      };
    };

    const schemaProblems = collectStrictSchemaProblems(request.textFormat?.schema);

    expect(schemaProblems).toEqual([]);
  });

  it("returns raw fallback when the model replies with readable text but not a formal outline payload", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: [
        "I can draft this paper around finance risk governance.",
        "Suggested structure:",
        "1. Introduction",
        "2. Governance framework",
        "3. Regional banking cases"
      ].join("\n")
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "Focus on governance.",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Assignment brief text."
        }
      ]
    });

    expect(result.outline).toBeNull();
    expect(result.analysis.analysisRenderMode).toBe("raw_model");
    expect(result.analysis.rawModelResponse).toContain("Suggested structure");
    expect(result.analysis.appliedSpecialRequirements).toBe("Focus on governance.");
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the structured path when the model says the user must confirm the main task file", async () => {
    requestOpenAITextResponseMock.mockResolvedValueOnce({
      output_text: JSON.stringify({
        analysis: {
          chosenTaskFileId: null,
          supportingFileIds: ["file-1", "file-2"],
          ignoredFileIds: [],
          needsUserConfirmation: true,
          reasoning: "Two files both look like task briefs, so the user must confirm.",
          targetWordCount: 2000,
          citationStyle: "APA 7",
          topic: "Education Policy Essay",
          chapterCount: 4,
          mustCover: [],
          gradingFocus: [],
          appliedSpecialRequirements: "",
          usedDefaultWordCount: true,
          usedDefaultCitationStyle: true,
          warnings: []
        },
        outline: null
      })
    });

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "brief-a.txt",
          extractedText: "Brief A"
        },
        {
          id: "file-2",
          originalFilename: "brief-b.txt",
          extractedText: "Brief B"
        }
      ]
    });

    expect(result.analysis.needsUserConfirmation).toBe(true);
    expect(result.analysis.analysisRenderMode).toBe("structured");
    expect(result.outline).toBeNull();
    expect(requestOpenAITextResponseMock).toHaveBeenCalledTimes(1);
  });

  it("fails fast when a transport-only pdf did not get an OpenAI file id", async () => {
    await expect(
      analyzeUploadedTaskWithOpenAI({
        specialRequirements: "",
        files: [
          {
            id: "pdf-1",
            originalFilename: "assignment.pdf",
            extractedText: "[pdf transport-only: assignment.pdf]",
            contentType: "application/pdf",
            openaiFileId: null
          }
        ]
      })
    ).rejects.toThrow("MODEL_INPUT_NOT_READY");

    expect(requestOpenAITextResponseMock).not.toHaveBeenCalled();
  });

  it("returns provider raw error details when the upstream api fails but still returns a body", async () => {
    const providerError = new Error(
      'OpenAI request failed with status 502: {"error":{"message":"upstream gateway exploded"}}'
    ) as Error & {
      providerStatusCode?: number;
      providerErrorBody?: string;
      providerErrorKind?: string;
    };
    providerError.providerStatusCode = 502;
    providerError.providerErrorBody = '{"error":{"message":"upstream gateway exploded"}}';
    providerError.providerErrorKind = "http_error";

    requestOpenAITextResponseMock.mockRejectedValueOnce(providerError);

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Assignment brief text."
        }
      ]
    });

    expect(result.outline).toBeNull();
    expect(result.analysis.analysisRenderMode).toBe("raw_provider_error");
    expect(result.analysis.providerStatusCode).toBe(502);
    expect(result.analysis.providerErrorKind).toBe("http_error");
    expect(result.analysis.providerErrorBody).toContain("gateway exploded");
    expect(result.analysis.rawModelResponse).toBeNull();
  });

  it("falls back to system error mode when the upstream api fails without any response body", async () => {
    const providerError = new Error("OpenAI request timed out") as Error & {
      providerStatusCode?: number;
      providerErrorBody?: string;
      providerErrorKind?: string;
    };
    providerError.providerErrorKind = "timeout";

    requestOpenAITextResponseMock.mockRejectedValueOnce(providerError);

    const result = await analyzeUploadedTaskWithOpenAI({
      specialRequirements: "",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText: "Assignment brief text."
        }
      ]
    });

    expect(result.outline).toBeNull();
    expect(result.analysis.analysisRenderMode).toBe("system_error");
    expect(result.analysis.providerErrorKind).toBe("timeout");
    expect(result.analysis.providerErrorBody).toBeNull();
  });

  it("still succeeds when OpenAI only returns text inside output message content", async () => {
    vi.resetModules();
    vi.doUnmock("../../src/lib/ai/openai-client");
    process.env.OPENAI_API_KEY = "test-key";

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            type: "reasoning",
            summary: []
          },
          {
            type: "message",
            status: "completed",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  analysis: {
                    chosenTaskFileId: "file-1",
                    supportingFileIds: [],
                    ignoredFileIds: [],
                    needsUserConfirmation: false,
                    reasoning: "The first file is the task brief.",
                    targetWordCount: 2200,
                    citationStyle: "Harvard",
                    topic: "Finance Risk Governance in ASEAN Banks",
                    chapterCount: 5,
                    mustCover: ["Governance framework", "Regional cases"],
                    gradingFocus: ["Critical analysis"],
                    appliedSpecialRequirements: "Only generate the first outline.",
                    usedDefaultWordCount: false,
                    usedDefaultCitationStyle: false,
                    warnings: []
                  },
                  outline: {
                    articleTitle: "Finance Risk Governance in ASEAN Banks",
                    sections: [
                      {
                        title: "Introduction",
                        summary: "Set the scope and thesis.",
                        bulletPoints: ["Context", "Problem", "Argument"]
                      }
                    ]
                  }
                })
              }
            ]
          }
        ]
      })
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { analyzeUploadedTaskWithOpenAI: analyzeWithRealClient } = await import(
      "../../src/lib/ai/services/analyze-uploaded-task"
    );

    const result = await analyzeWithRealClient({
      specialRequirements: "Only generate the first outline.",
      files: [
        {
          id: "file-1",
          originalFilename: "assignment.txt",
          extractedText:
            "Write a 2200 word essay about finance risk governance in ASEAN banks with Harvard referencing."
        }
      ]
    });

    expect(result.analysis.analysisRenderMode).toBe("structured");
    expect(result.analysis.targetWordCount).toBe(2200);
    expect(result.outline?.articleTitle).toBe("Finance Risk Governance in ASEAN Banks");
  });
});
