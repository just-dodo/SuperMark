/**
 * Image file analyzer.
 */

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { callLlm } from "../ai/llm.js";
import type { AnalysisResult, Config } from "./types.js";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20MB

interface SharpMetadata {
  width?: number;
  height?: number;
  format?: string;
  space?: string;
  hasAlpha?: boolean;
}

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
  extractedText?: string;
}

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
  };
  return map[ext] ?? "image/png";
}

async function getSharpMetadata(filePath: string): Promise<SharpMetadata | null> {
  try {
    // Dynamic import to avoid hard dependency errors if sharp is unavailable
    const sharp = (await import("sharp")).default;
    const metadata = await sharp(filePath).metadata();
    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      space: metadata.space,
      hasAlpha: metadata.hasAlpha,
    };
  } catch {
    return null;
  }
}

export async function analyzeImage(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const buffer = readFileSync(filePath);
  const mimeType = getMimeType(filePath);
  const fileName = basename(filePath);
  const sizeBytes = buffer.length;
  const isSvg = mimeType === "image/svg+xml";

  // Get image dimensions via sharp (best-effort)
  const sharpMeta = await getSharpMetadata(filePath);

  // If image is too large, return metadata-only digest
  if (sizeBytes > MAX_IMAGE_BYTES) {
    return {
      summary: `Large image file: ${fileName} (${(sizeBytes / 1024 / 1024).toFixed(1)}MB — vision analysis skipped)`,
      contentAnalysis: `File exceeds 20MB limit for vision analysis. Metadata only.`,
      keyDetails: [
        `Size: ${(sizeBytes / 1024 / 1024).toFixed(2)}MB`,
        ...(sharpMeta?.width && sharpMeta?.height
          ? [`Dimensions: ${sharpMeta.width}x${sharpMeta.height}`]
          : []),
        `Format: ${mimeType}`,
      ],
      aiContext: `Large image file ${fileName} (${mimeType}, ${(sizeBytes / 1024 / 1024).toFixed(1)}MB). Vision analysis skipped due to size limit.`,
      metadata: {
        format: mimeType,
        width: sharpMeta?.width,
        height: sharpMeta?.height,
        hasAlpha: sharpMeta?.hasAlpha,
        colorSpace: sharpMeta?.space,
        sizeBytes,
      },
    };
  }

  const imageBase64 = buffer.toString("base64");

  // Build prompt — include raw SVG text for SVG files
  let svgContext = "";
  if (isSvg) {
    const svgText = buffer.toString("utf-8");
    svgContext = `\n\nRaw SVG source:\n\`\`\`xml\n${svgText.slice(0, 10000)}\n\`\`\``;
  }

  const dimensionHint =
    sharpMeta?.width && sharpMeta?.height
      ? ` (${sharpMeta.width}x${sharpMeta.height}px)`
      : "";

  const prompt = `Analyze this image (${mimeType}${dimensionHint}) and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this image shows
- "contentAnalysis": Detailed visual description covering elements, layout, colors, text if any, and overall composition
- "keyDetails": Array of strings describing notable aspects (style, purpose, technical details, text content)
- "aiContext": A concise AI-friendly description optimized for downstream consumption
- "extractedText": If the image contains any readable text (signs, documents, labels, UI, handwriting, etc.), extract ALL of it verbatim. If no text is found, use an empty string.${svgContext}`;

  const systemPrompt =
    "You are an image analysis expert. Analyze images thoroughly and respond only with valid JSON, never with markdown code fences or extra text.";

  const response = await callLlm(
    {
      prompt,
      systemPrompt,
      images: [{ base64: imageBase64, mimeType }],
      maxTokens: 2000,
    },
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
    summary: parsed.summary ?? `Image analysis of ${fileName}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails) ? parsed.keyDetails : [],
    aiContext: parsed.aiContext ?? "",
    rawContent: parsed.extractedText || undefined,
    metadata: {
      format: mimeType,
      width: sharpMeta?.width,
      height: sharpMeta?.height,
      hasAlpha: sharpMeta?.hasAlpha,
      colorSpace: sharpMeta?.space,
      sizeBytes,
    },
  };
}
