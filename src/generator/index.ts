/**
 * Markdown digest generator — converts analysis results to markdown files.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, basename, extname } from "node:path";
import type { AnalysisResult, Config } from "../analyzers/types.js";

export interface DigestOptions {
  filePath: string;
  result: AnalysisResult;
  config: Config;
}

export function generateDigest(options: DigestOptions): string {
  const { filePath, result } = options;
  const fileName = basename(filePath);
  const now = new Date().toISOString();

  const lines: string[] = [
    `# ${fileName}`,
    "",
    `> Auto-generated digest — ${now}`,
    "",
    "## Summary",
    "",
    result.summary || "_No summary available._",
    "",
    "## Content Analysis",
    "",
    result.contentAnalysis || "_No content analysis available._",
    "",
  ];

  if (result.keyDetails.length > 0) {
    lines.push("## Key Details", "");
    for (const detail of result.keyDetails) {
      lines.push(`- ${detail}`);
    }
    lines.push("");
  }

  if (result.aiContext) {
    lines.push("## AI Context", "");
    lines.push(result.aiContext);
    lines.push("");
  }

  if (Object.keys(result.metadata).length > 0) {
    lines.push("## Metadata", "");
    lines.push("```json");
    lines.push(JSON.stringify(result.metadata, null, 2));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

export function writeDigest(options: DigestOptions): string {
  const markdown = generateDigest(options);
  const { filePath, config } = options;

  mkdirSync(config.outputDir, { recursive: true });

  const baseName = basename(filePath, extname(filePath));
  const outputPath = join(config.outputDir, `${baseName}.md`);

  writeFileSync(outputPath, markdown, "utf-8");
  return outputPath;
}
