/**
 * PDF and DOCX document analyzer.
 */

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { callLlm } from "../ai/llm.js";
import type { AnalysisResult, Config } from "./types.js";

const MAX_CONTENT_CHARS = 50000;

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

export async function analyzeDocument(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const ext = extname(filePath).toLowerCase();
  let extractedText = "";
  let pageCount: number | undefined;
  let format: string;

  if (ext === ".pdf") {
    format = "PDF";
    const buffer = readFileSync(filePath);
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const infoResult = await parser.getInfo();
    pageCount = infoResult.total;
    const textResult = await parser.getText();
    extractedText = textResult.text;
    await parser.destroy();
  } else if (ext === ".docx") {
    format = "DOCX";
    const result = await mammoth.extractRawText({ path: filePath });
    extractedText = result.value;
  } else if (ext === ".doc") {
    format = "DOC";
    try {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    } catch {
      return {
        summary: `Legacy DOC file: ${basename(filePath)}. The .doc format requires conversion to .docx for full analysis.`,
        contentAnalysis: "The .doc (legacy Word) format is not fully supported. Please convert to .docx for analysis.",
        keyDetails: ["File format: Legacy .doc (Word 97-2003)", "Conversion to .docx required for full text extraction"],
        aiContext: `Legacy .doc file at ${filePath}. Content could not be extracted without format conversion.`,
        metadata: { format: "DOC", unsupported: true },
      };
    }
  } else {
    format = ext.slice(1).toUpperCase();
    extractedText = "";
  }

  let truncated = false;
  let content = extractedText;
  if (content.length > MAX_CONTENT_CHARS) {
    content =
      content.slice(0, MAX_CONTENT_CHARS) +
      "\n\n[Content truncated — exceeds 50,000 characters]";
    truncated = true;
  }

  const wordCount = extractedText.split(/\s+/).filter(Boolean).length;
  const charCount = extractedText.length;

  const prompt = `Analyze the following extracted text from a ${format} document and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this document is about
- "contentAnalysis": Detailed breakdown of the document structure, main topics, key sections
- "keyDetails": Array of strings describing notable aspects (author intent, key arguments, important data, structure)
- "aiContext": A concise description optimized for AI consumption

Extracted document text:
\`\`\`
${content}
\`\`\``;

  const systemPrompt =
    "You are a document analysis expert. Analyze the extracted text from documents thoroughly and respond only with valid JSON.";

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
    rawContent: extractedText || undefined,
    metadata: {
      format,
      ...(pageCount !== undefined ? { pageCount } : {}),
      wordCount,
      charCount,
      truncated,
    },
  };
}
