import { env } from "@/src/config/env";
import type { HumanizeProvider } from "./humanize-provider";
import { UndetectableProvider } from "./undetectable-provider";

export function resolveHumanizeProvider(
  overrideProvider?: HumanizeProvider
): HumanizeProvider {
  if (overrideProvider) {
    return overrideProvider;
  }

  if (!env.UNDETECTABLE_API_KEY) {
    throw new Error("UNDETECTABLE_API_KEY_MISSING");
  }

  return new UndetectableProvider({ apiKey: env.UNDETECTABLE_API_KEY });
}
