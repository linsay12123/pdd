import type {
  HumanizeChunkInput,
  HumanizeChunkResult,
  HumanizeProvider
} from "./humanize-provider";

export class PlaceholderHumanizeProvider implements HumanizeProvider {
  readonly name = "placeholder";

  async rewriteChunk(input: HumanizeChunkInput): Promise<HumanizeChunkResult> {
    return { rewrittenText: input.chunk };
  }
}
