/**
 * LLM client for OpenAI and Anthropic APIs.
 */

import type { Config } from "../analyzers/types.js";

export interface LlmRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function callLlm(
  _request: LlmRequest,
  _config: Config,
): Promise<LlmResponse> {
  // TODO: Implement OpenAI/Anthropic LLM calls
  return {
    content: "",
  };
}
