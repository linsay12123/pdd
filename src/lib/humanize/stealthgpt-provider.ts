import type {
  HumanizeChunkInput,
  HumanizeChunkResult,
  HumanizeProvider
} from "./humanize-provider";

type StealthGptResponse = {
  result?: string;
};

function buildStealthGptPayload(prompt: string) {
  return {
    prompt,
    rephrase: true,
    tone: "PhD",
    mode: "Medium",
    qualityMode: "quality",
    business: false,
    isMultilingual: true,
    detector: "turnitin"
  };
}

export class StealthGptProvider implements HumanizeProvider {
  readonly name = "stealthgpt";
  private apiKey: string;
  private apiUrl: string;
  private fetchImpl: typeof fetch;

  constructor(options: {
    apiKey: string;
    apiUrl?: string;
    fetchImpl?: typeof fetch;
  }) {
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl ?? "https://stealthgpt.ai/api/stealthify";
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async rewriteChunk(input: HumanizeChunkInput): Promise<HumanizeChunkResult> {
    if (!input.chunk.trim()) {
      return { rewrittenText: "" };
    }

    const response = await this.fetchImpl(this.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-token": this.apiKey
      },
      body: JSON.stringify(buildStealthGptPayload(input.chunk))
    });

    if (!response.ok) {
      throw new Error(`StealthGPT request failed with status ${response.status}`);
    }

    const data = (await response.json()) as StealthGptResponse;
    return { rewrittenText: (data.result ?? "").trim() };
  }
}
