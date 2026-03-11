/**
 * AI provider router — dispatches to the appropriate AI backend.
 */

import type { Config } from "../analyzers/types.js";
import { callLlm } from "./llm.js";
import type { LlmRequest, LlmResponse } from "./llm.js";
import { transcribe } from "./whisper.js";
import type { TranscriptionResult } from "./whisper.js";
import { analyzeWithGemini } from "./gemini.js";
import type { GeminiAnalysisResult } from "./gemini.js";

export async function summarize(
  text: string,
  config: Config,
): Promise<string> {
  const response = await callLlm(
    {
      prompt: text,
      systemPrompt: "Summarize the following content concisely.",
    },
    config,
  );
  return response.content;
}

export {
  callLlm,
  transcribe,
  analyzeWithGemini,
};

export type {
  LlmRequest,
  LlmResponse,
  TranscriptionResult,
  GeminiAnalysisResult,
};
