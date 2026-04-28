import Anthropic from "@anthropic-ai/sdk";
import { Config } from "../config.js";

let _anthropic: Anthropic | null = null;

export function getAnthropic(config: Config): Anthropic {
  if (!_anthropic) {
    _anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
      defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" },
    });
  }
  return _anthropic;
}
