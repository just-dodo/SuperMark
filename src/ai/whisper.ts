/**
 * Whisper speech-to-text client.
 */

import { createReadStream, statSync } from "node:fs";
import OpenAI from "openai";
import type { Config } from "../analyzers/types.js";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

let client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey)
      throw new Error("OPENAI_API_KEY environment variable is required");
    client = new OpenAI({ apiKey });
  }
  return client;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

export async function transcribe(
  filePath: string,
  config: Config,
): Promise<TranscriptionResult> {
  const stats = statSync(filePath);
  if (stats.size > MAX_FILE_SIZE) {
    throw new Error(
      `Audio file exceeds 25MB Whisper limit (${(stats.size / 1024 / 1024).toFixed(1)}MB). Large file splitting not yet implemented.`,
    );
  }

  const openai = getClient();
  const transcription = await openai.audio.transcriptions.create({
    file: createReadStream(filePath),
    model: config.ai.whisperModel || "whisper-1",
    response_format: "verbose_json",
  });

  return {
    text: transcription.text,
    language: (transcription as unknown as Record<string, unknown>)
      .language as string | undefined,
    duration: (transcription as unknown as Record<string, unknown>)
      .duration as number | undefined,
  };
}
