/**
 * Audio file analyzer.
 */

import { basename, extname } from "node:path";
import { callLlm } from "../ai/llm.js";
import { transcribe } from "../ai/whisper.js";
import { getMediaMetadata } from "../utils/media.js";
import type { AnalysisResult, Config } from "./types.js";

const MAX_TRANSCRIPTION_CHARS = 50000;

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

export async function analyzeAudio(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const fileName = basename(filePath);
  const format = extname(filePath).toLowerCase().replace(".", "");

  // 1. Get media metadata via ffprobe (best-effort)
  let duration: number | undefined;
  let codec: string | undefined;
  let channels: number | undefined;
  let sampleRate: number | undefined;
  let bitrate: number | undefined;

  try {
    const meta = await getMediaMetadata(filePath);
    duration = meta.duration;
    codec = meta.codec;
    channels = meta.channels;
    sampleRate = meta.sampleRate;
    bitrate = meta.bitrate;
  } catch {
    // ffprobe unavailable or failed — continue without metadata
  }

  // 2. Transcribe audio via Whisper
  let transcriptionText = "";
  let language: string | undefined;
  let transcriptionError: string | undefined;

  try {
    const result = await transcribe(filePath, config);
    transcriptionText = result.text;
    language = result.language;
    if (result.duration !== undefined && duration === undefined) {
      duration = result.duration;
    }
  } catch (err) {
    transcriptionError =
      err instanceof Error ? err.message : "Transcription failed";
  }

  // 3. If no transcription available, produce a minimal result
  if (!transcriptionText) {
    return {
      summary: `Audio file: ${fileName}${transcriptionError ? ` (transcription failed: ${transcriptionError})` : ""}`,
      contentAnalysis: transcriptionError
        ? `Transcription could not be completed: ${transcriptionError}`
        : "No speech content detected.",
      keyDetails: [
        ...(format ? [`Format: ${format}`] : []),
        ...(duration !== undefined
          ? [`Duration: ${duration.toFixed(1)}s`]
          : []),
        ...(codec ? [`Codec: ${codec}`] : []),
        ...(channels !== undefined ? [`Channels: ${channels}`] : []),
        ...(sampleRate !== undefined ? [`Sample rate: ${sampleRate}Hz`] : []),
        ...(bitrate !== undefined
          ? [`Bitrate: ${Math.round(bitrate / 1000)}kbps`]
          : []),
      ],
      aiContext: `Audio file (${format}) with no available transcription.`,
      metadata: {
        format,
        ...(duration !== undefined && { duration }),
        ...(codec && { codec }),
        ...(channels !== undefined && { channels }),
        ...(sampleRate !== undefined && { sampleRate }),
        ...(bitrate !== undefined && { bitrate }),
        transcriptionLength: 0,
      },
    };
  }

  // 4. Truncate transcription if needed
  let transcriptionForLlm = transcriptionText;
  const truncated = transcriptionText.length > MAX_TRANSCRIPTION_CHARS;
  if (truncated) {
    transcriptionForLlm =
      transcriptionText.slice(0, MAX_TRANSCRIPTION_CHARS) +
      "\n\n[Transcription truncated — exceeds 50,000 characters]";
  }

  // 5. Send transcription to LLM for analysis
  const prompt = `Analyze this audio transcription. Respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this audio is about
- "contentAnalysis": Detailed breakdown of the audio content, topics discussed, tone, and structure
- "keyDetails": Array of strings describing notable aspects (speakers, topics, key points, sentiment)
- "aiContext": A concise description optimized for AI consumption

${language ? `Detected language: ${language}\n` : ""}${duration !== undefined ? `Duration: ${duration.toFixed(1)} seconds\n` : ""}
Transcription:
\`\`\`
${transcriptionForLlm}
\`\`\``;

  const systemPrompt =
    "You are an audio content analysis expert. Analyze transcriptions thoroughly and respond only with valid JSON, never with markdown code fences or extra text.";

  const response = await callLlm(
    { prompt, systemPrompt, maxTokens: 2000 },
    config,
  );

  let parsed: LlmAnalysisJson = {};
  try {
    let raw = response.content.trim();
    const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      raw = fenceMatch[1].trim();
    }
    parsed = JSON.parse(raw) as LlmAnalysisJson;
  } catch {
    parsed = {
      summary: response.content.slice(0, 500),
      contentAnalysis: response.content,
      keyDetails: [],
      aiContext: response.content.slice(0, 200),
    };
  }

  return {
    summary: parsed.summary ?? `Audio analysis of ${fileName}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails) ? parsed.keyDetails : [],
    aiContext: parsed.aiContext ?? "",
    metadata: {
      format,
      ...(duration !== undefined && { duration }),
      ...(codec && { codec }),
      ...(channels !== undefined && { channels }),
      ...(sampleRate !== undefined && { sampleRate }),
      ...(bitrate !== undefined && { bitrate }),
      transcriptionLength: transcriptionText.length,
    },
  };
}
