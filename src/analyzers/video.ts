/**
 * Video file analyzer.
 */

import { statSync } from "node:fs";
import { extname, basename } from "node:path";
import { getMediaMetadata } from "../utils/media.js";
import { analyzeWithGemini, VIDEO_ANALYSIS_PROMPT } from "../ai/gemini.js";
import type { AnalysisResult, Config } from "./types.js";

export async function analyzeVideo(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const sizeBytes = statSync(filePath).size;

  // Get media metadata via ffprobe (best-effort)
  let mediaMeta: {
    duration?: number;
    codec?: string;
    bitrate?: number;
    width?: number;
    height?: number;
  } = {};

  try {
    mediaMeta = await getMediaMetadata(filePath);
  } catch {
    // ffprobe unavailable or failed — proceed without metadata
  }

  const resolution =
    mediaMeta.width && mediaMeta.height
      ? `${mediaMeta.width}x${mediaMeta.height}`
      : undefined;

  const durationStr = mediaMeta.duration
    ? `${mediaMeta.duration.toFixed(1)}s`
    : undefined;

  const sizeStr = `${(sizeBytes / 1024 / 1024).toFixed(2)}MB`;

  // Attempt Gemini analysis
  let geminiResult: {
    description: string;
    transcription?: string;
    sceneDescriptions?: string[];
    keyMoments?: string[];
  } | null = null;

  try {
    geminiResult = await analyzeWithGemini(filePath, VIDEO_ANALYSIS_PROMPT, config);
  } catch {
    // Gemini unavailable — fall back to metadata-only result
  }

  if (!geminiResult) {
    // Metadata-only fallback
    const keyDetails: string[] = [`Size: ${sizeStr}`, `Format: ${ext}`];
    if (durationStr) keyDetails.push(`Duration: ${durationStr}`);
    if (resolution) keyDetails.push(`Resolution: ${resolution}`);
    if (mediaMeta.codec) keyDetails.push(`Codec: ${mediaMeta.codec}`);

    return {
      summary: `Video file: ${fileName} (${sizeStr}${durationStr ? `, ${durationStr}` : ""})`,
      contentAnalysis: "Video content analysis unavailable (Gemini API not configured).",
      keyDetails,
      aiContext: `Video file ${fileName} (${ext}, ${sizeStr}${resolution ? `, ${resolution}` : ""}${durationStr ? `, ${durationStr}` : ""}). Content analysis skipped.`,
      metadata: {
        format: ext,
        duration: mediaMeta.duration,
        resolution,
        codec: mediaMeta.codec,
        frameRate: undefined,
        sizeBytes,
      },
    };
  }

  // Build structured result from Gemini output
  const keyDetails: string[] = [];
  if (durationStr) keyDetails.push(`Duration: ${durationStr}`);
  if (resolution) keyDetails.push(`Resolution: ${resolution}`);
  if (mediaMeta.codec) keyDetails.push(`Codec: ${mediaMeta.codec}`);
  keyDetails.push(`Size: ${sizeStr}`);
  keyDetails.push(`Format: ${ext}`);

  if (geminiResult.transcription) {
    keyDetails.push(`Transcription available: yes`);
  }

  if (geminiResult.keyMoments && geminiResult.keyMoments.length > 0) {
    keyDetails.push(...geminiResult.keyMoments.slice(0, 5));
  }

  const sceneText =
    geminiResult.sceneDescriptions && geminiResult.sceneDescriptions.length > 0
      ? `\n\nScenes:\n${geminiResult.sceneDescriptions.map((s, i) => `${i + 1}. ${s}`).join("\n")}`
      : "";

  const transcriptionText = geminiResult.transcription
    ? `\n\nTranscription:\n${geminiResult.transcription}`
    : "";

  const contentAnalysis =
    `${geminiResult.description}${sceneText}${transcriptionText}`.trim();

  const aiContext = [
    `Video file: ${fileName}`,
    resolution ? `Resolution: ${resolution}` : null,
    durationStr ? `Duration: ${durationStr}` : null,
    mediaMeta.codec ? `Codec: ${mediaMeta.codec}` : null,
    `Size: ${sizeStr}`,
    geminiResult.description ? `Content: ${geminiResult.description.slice(0, 300)}` : null,
  ]
    .filter(Boolean)
    .join(". ");

  return {
    summary: geminiResult.description
      ? geminiResult.description.slice(0, 300)
      : `Video file: ${fileName} (${sizeStr})`,
    contentAnalysis,
    keyDetails,
    aiContext,
    rawContent: geminiResult.transcription || undefined,
    metadata: {
      format: ext,
      duration: mediaMeta.duration,
      resolution,
      codec: mediaMeta.codec,
      frameRate: undefined,
      sizeBytes,
    },
  };
}
