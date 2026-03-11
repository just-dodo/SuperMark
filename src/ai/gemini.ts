/**
 * Gemini API client for video and multimodal analysis.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import type { Config } from "../analyzers/types.js";

export interface GeminiAnalysisResult {
  description: string;
  transcription?: string;
  sceneDescriptions?: string[];
  keyMoments?: string[];
}

const VIDEO_MIME_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".wmv": "video/x-ms-wmv",
  ".flv": "video/x-flv",
};

const MAX_INLINE_BYTES = 20 * 1024 * 1024; // 20MB

const VIDEO_ANALYSIS_PROMPT = `Analyze this video file and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "description": Overall description of the video content
- "transcription": Transcription of any speech or dialogue in the video (empty string if none)
- "sceneDescriptions": Array of scene-by-scene descriptions
- "keyMoments": Array of notable moments or key timestamps`;

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}

interface GeminiAnalysisJson {
  description?: string;
  transcription?: string;
  sceneDescriptions?: string[];
  keyMoments?: string[];
}

function parseGeminiResponse(text: string): GeminiAnalysisJson {
  let raw = text.trim();
  const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (fenceMatch) {
    raw = fenceMatch[1].trim();
  }
  return JSON.parse(raw) as GeminiAnalysisJson;
}

async function analyzeInline(
  filePath: string,
  prompt: string,
): Promise<GeminiAnalysisResult> {
  const client = getClient();
  const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

  const buffer = readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = extname(filePath).toLowerCase();
  const mimeType = VIDEO_MIME_TYPES[ext] ?? "video/mp4";

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt },
  ]);

  const text = result.response.text();

  let parsed: GeminiAnalysisJson = {};
  try {
    parsed = parseGeminiResponse(text);
  } catch {
    parsed = { description: text.slice(0, 1000) };
  }

  return {
    description: parsed.description ?? "",
    transcription: parsed.transcription,
    sceneDescriptions: Array.isArray(parsed.sceneDescriptions) ? parsed.sceneDescriptions : [],
    keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments : [],
  };
}

async function analyzeViaFileApi(
  filePath: string,
  prompt: string,
): Promise<GeminiAnalysisResult> {
  try {
    const { GoogleAIFileManager } = await import("@google/generative-ai/server");
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is required");

    const fileManager = new GoogleAIFileManager(apiKey);
    const ext = extname(filePath).toLowerCase();
    const mimeType = VIDEO_MIME_TYPES[ext] ?? "video/mp4";

    const uploadResult = await fileManager.uploadFile(filePath, {
      mimeType,
      displayName: filePath.split("/").pop() ?? "video",
    });

    const fileUri = uploadResult.file.uri;

    const client = getClient();
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" });

    const result = await model.generateContent([
      {
        fileData: {
          mimeType,
          fileUri,
        },
      },
      { text: prompt },
    ]);

    const text = result.response.text();

    let parsed: GeminiAnalysisJson = {};
    try {
      parsed = parseGeminiResponse(text);
    } catch {
      parsed = { description: text.slice(0, 1000) };
    }

    return {
      description: parsed.description ?? "",
      transcription: parsed.transcription,
      sceneDescriptions: Array.isArray(parsed.sceneDescriptions) ? parsed.sceneDescriptions : [],
      keyMoments: Array.isArray(parsed.keyMoments) ? parsed.keyMoments : [],
    };
  } catch {
    // File API unavailable or failed — return size-exceeded notice
    return {
      description: "Video file exceeds 20MB inline limit and File API analysis was unavailable.",
      transcription: "",
      sceneDescriptions: [],
      keyMoments: [],
    };
  }
}

export async function analyzeWithGemini(
  filePath: string,
  prompt: string,
  _config: Config,
): Promise<GeminiAnalysisResult> {
  const sizeBytes = statSync(filePath).size;

  if (sizeBytes > MAX_INLINE_BYTES) {
    return analyzeViaFileApi(filePath, prompt);
  }

  return analyzeInline(filePath, prompt);
}

export { VIDEO_ANALYSIS_PROMPT };
