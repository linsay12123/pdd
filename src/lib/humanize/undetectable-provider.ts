import {
  defaultHumanizeProfile,
  type HumanizeDocumentResult,
  type HumanizeDocumentSubmissionInput,
  type HumanizeDocumentSubmissionResult,
  type HumanizeProvider
} from "./humanize-provider";

type UndetectableSubmitResponse = {
  id?: string;
  status?: string;
  error?: string;
  message?: string;
};

type UndetectableDocumentResponse = {
  id?: string;
  status?: string;
  output?: string;
  error?: string;
  message?: string;
};

function normalizeErrorMessage(payload: {
  error?: string;
  message?: string;
}) {
  return payload.error?.trim() || payload.message?.trim() || null;
}

export class UndetectableProvider implements HumanizeProvider {
  readonly name = "undetectable";
  private apiKey: string;
  private fetchImpl: typeof fetch;
  private endpoints: {
    submit: string;
    document: string;
    rehumanize: string;
  };

  constructor(options: {
    apiKey: string;
    fetchImpl?: typeof fetch;
    endpoints?: Partial<{
      submit: string;
      document: string;
      rehumanize: string;
    }>;
  }) {
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.endpoints = {
      submit: options.endpoints?.submit ?? "https://humanize.undetectable.ai/submit",
      document: options.endpoints?.document ?? "https://humanize.undetectable.ai/document",
      rehumanize:
        options.endpoints?.rehumanize ?? "https://humanize.undetectable.ai/rehumanize"
    };
  }

  async submitDocument(
    input: HumanizeDocumentSubmissionInput
  ): Promise<HumanizeDocumentSubmissionResult> {
    if (!input.content.trim()) {
      throw new Error("UNDTECTABLE_EMPTY_CONTENT");
    }

    const profile = input.profile ?? defaultHumanizeProfile;
    const response = await this.fetchImpl(this.endpoints.submit, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey
      },
      body: JSON.stringify({
        content: input.content,
        ...profile
      })
    });

    const payload = (await response.json().catch(() => null)) as UndetectableSubmitResponse | null;

    if (!response.ok) {
      throw new Error(
        normalizeErrorMessage(payload ?? {}) ??
          `Undetectable submit failed with status ${response.status}`
      );
    }

    const documentId = payload?.id?.trim();
    if (!documentId) {
      throw new Error("UNDTECTABLE_MISSING_DOCUMENT_ID");
    }

    return {
      documentId,
      status: payload?.status?.trim() || "pending"
    };
  }

  async getDocument(documentId: string): Promise<HumanizeDocumentResult> {
    const response = await this.fetchImpl(this.endpoints.document, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey
      },
      body: JSON.stringify({
        id: documentId
      })
    });

    const payload = (await response.json().catch(() => null)) as
      | UndetectableDocumentResponse
      | null;

    if (!response.ok) {
      throw new Error(
        normalizeErrorMessage(payload ?? {}) ??
          `Undetectable document lookup failed with status ${response.status}`
      );
    }

    return {
      documentId: payload?.id?.trim() || documentId,
      status:
        payload?.status?.trim() ||
        (payload?.output?.trim() ? "done" : "pending"),
      output: payload?.output?.trim() || null,
      errorMessage: normalizeErrorMessage(payload ?? {})
    };
  }

  async rehumanize(documentId: string): Promise<HumanizeDocumentSubmissionResult> {
    const response = await this.fetchImpl(this.endpoints.rehumanize, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey
      },
      body: JSON.stringify({
        id: documentId
      })
    });

    const payload = (await response.json().catch(() => null)) as UndetectableSubmitResponse | null;

    if (!response.ok) {
      throw new Error(
        normalizeErrorMessage(payload ?? {}) ??
          `Undetectable rehumanize failed with status ${response.status}`
      );
    }

    const nextId = payload?.id?.trim();
    if (!nextId) {
      throw new Error("UNDTECTABLE_MISSING_REHUMANIZE_ID");
    }

    return {
      documentId: nextId,
      status: payload?.status?.trim() || "pending"
    };
  }
}
