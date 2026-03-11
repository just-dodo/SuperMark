/**
 * PPTX presentation analyzer.
 */

import { readFileSync, mkdtempSync, rmSync, readdirSync, existsSync } from "node:fs";
import { extname, basename, join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";
import { callLlm } from "../ai/llm.js";
import type { AnalysisResult, Config } from "./types.js";

const MAX_CONTENT_CHARS = 50000;

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

function stripXmlTags(xml: string): string {
  return xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function analyzePresentation(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".ppt") {
    return {
      summary: `Legacy PPT file: ${basename(filePath)}. The .ppt format requires conversion to .pptx for full analysis.`,
      contentAnalysis: "The .ppt (legacy PowerPoint) format is not supported. Please convert to .pptx for analysis.",
      keyDetails: ["File format: Legacy .ppt (PowerPoint 97-2003)", "Conversion to .pptx required for text extraction"],
      aiContext: `Legacy .ppt file at ${filePath}. Content could not be extracted without format conversion.`,
      metadata: { format: "PPT", unsupported: true },
    };
  }

  // PPTX is a ZIP archive — extract and parse slide XML files
  const tempDir = mkdtempSync(join(tmpdir(), "supermark-pptx-"));
  let slideCount = 0;
  let slidesText = "";

  try {
    execSync(`unzip -o ${JSON.stringify(filePath)} -d ${JSON.stringify(tempDir)}`, {
      stdio: "ignore",
    });

    const slidesDir = join(tempDir, "ppt", "slides");
    if (existsSync(slidesDir)) {
      const slideFiles = readdirSync(slidesDir)
        .filter((f) => /^slide\d+\.xml$/i.test(f))
        .sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ""), 10);
          const numB = parseInt(b.replace(/\D/g, ""), 10);
          return numA - numB;
        });

      slideCount = slideFiles.length;

      for (let i = 0; i < slideFiles.length; i++) {
        const slideXml = readFileSync(join(slidesDir, slideFiles[i]), "utf-8");
        const slideText = stripXmlTags(slideXml);
        if (slideText.length > 0) {
          slidesText += `Slide ${i + 1}: ${slideText}\n`;
        }
      }
    }
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  if (!slidesText.trim()) {
    return {
      summary: `PPTX file with no extractable text: ${basename(filePath)}`,
      contentAnalysis: "No text content could be extracted from the slides.",
      keyDetails: [`Slide count: ${slideCount}`, "No readable text found in slides"],
      aiContext: `Empty or image-only PPTX presentation at ${filePath}.`,
      metadata: { format: "PPTX", slideCount, charCount: 0 },
    };
  }

  let truncated = false;
  let content = slidesText;
  if (content.length > MAX_CONTENT_CHARS) {
    content =
      content.slice(0, MAX_CONTENT_CHARS) +
      "\n\n[Content truncated — exceeds 50,000 characters]";
    truncated = true;
  }

  const charCount = slidesText.length;

  const prompt = `Analyze the following extracted text from a PowerPoint presentation (PPTX) and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this presentation is about and its key message
- "contentAnalysis": Detailed breakdown of the presentation structure, main topics per slide grouping, narrative flow
- "keyDetails": Array of strings describing notable aspects (audience, key arguments, data points, call to action)
- "aiContext": A concise description optimized for AI consumption

Extracted slide content:
\`\`\`
${content}
\`\`\``;

  const systemPrompt =
    "You are a presentation analysis expert. Analyze the extracted slide text thoroughly and respond only with valid JSON.";

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
    summary: parsed.summary ?? `Analysis of ${basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails) ? parsed.keyDetails : [],
    aiContext: parsed.aiContext ?? "",
    rawContent: slidesText,
    metadata: {
      format: "PPTX",
      slideCount,
      charCount,
      ...(truncated ? { truncated } : {}),
    },
  };
}
