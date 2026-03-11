/**
 * Whisper speech-to-text client.
 */

import type { Config } from "../analyzers/types.js";

export interface TranscriptionResult {
  text: string;
  language?: string;
  duration?: number;
}

export async function transcribe(
  _filePath: string,
  _config: Config,
): Promise<TranscriptionResult> {
  // TODO: Implement Whisper API transcription
  return {
    text: "",
  };
}
