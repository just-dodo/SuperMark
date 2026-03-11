/**
 * Gemini API client for video and multimodal analysis.
 */

import type { Config } from "../analyzers/types.js";

export interface GeminiAnalysisResult {
  description: string;
  keyFrames?: string[];
}

export async function analyzeWithGemini(
  _filePath: string,
  _prompt: string,
  _config: Config,
): Promise<GeminiAnalysisResult> {
  // TODO: Implement Gemini API for video/multimodal analysis
  return {
    description: "",
  };
}
