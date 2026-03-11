/**
 * LLM client for OpenAI API.
 */

import OpenAI from "openai";
import type { Config } from "../analyzers/types.js";

export interface LlmRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  images?: Array<{ base64: string; mimeType: string }>;
}

export interface LlmResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function callLlm(
  request: LlmRequest,
  config: Config,
): Promise<LlmResponse> {
  const openai = getClient();
  const model = config.ai.model || "gpt-4o";
  const maxTokens = request.maxTokens ?? 2000;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }

  if (request.images && request.images.length > 0) {
    const contentParts: OpenAI.Chat.ChatCompletionContentPart[] = [
      { type: "text", text: request.prompt },
    ];

    for (const image of request.images) {
      contentParts.push({
        type: "image_url",
        image_url: {
          url: `data:${image.mimeType};base64,${image.base64}`,
        },
      });
    }

    messages.push({ role: "user", content: contentParts });
  } else {
    messages.push({ role: "user", content: request.prompt });
  }

  try {
    const completion = await openai.chat.completions.create({
      model,
      messages,
      max_tokens: maxTokens,
    });

    const choice = completion.choices[0];
    if (!choice || !choice.message.content) {
      throw new Error("No content returned from OpenAI API");
    }

    return {
      content: choice.message.content,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
          }
        : undefined,
    };
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      throw new Error(
        `OpenAI API error: ${error.status} ${error.message}`,
      );
    }
    throw error;
  }
}
