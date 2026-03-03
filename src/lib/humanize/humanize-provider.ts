export type HumanizeChunkInput = {
  chunk: string;
};

export type HumanizeChunkResult = {
  rewrittenText: string;
};

export interface HumanizeProvider {
  readonly name: string;
  rewriteChunk(input: HumanizeChunkInput): Promise<HumanizeChunkResult>;
}
