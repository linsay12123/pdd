import { env } from "@/src/config/env";
import type { HumanizeProvider } from "./humanize-provider";
import { StealthGptProvider } from "./stealthgpt-provider";
import { PlaceholderHumanizeProvider } from "./placeholder-provider";

export function resolveHumanizeProvider(
  overrideProvider?: HumanizeProvider
): HumanizeProvider {
  if (overrideProvider) {
    return overrideProvider;
  }

  if (env.STEALTHGPT_API_KEY) {
    return new StealthGptProvider({ apiKey: env.STEALTHGPT_API_KEY });
  }

  return new PlaceholderHumanizeProvider();
}
