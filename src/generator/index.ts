/**
 * Markdown digest generator — converts analysis results to markdown files.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { join, basename, extname } from "node:path";
import { getFileInfo, formatFileSize, getFileHash } from "../utils/file.js";
import type { AnalysisResult, Config } from "../analyzers/types.js";

const extensionToType: Record<string, string> = {
  ".ts": "TypeScript", ".tsx": "TypeScript React", ".js": "JavaScript",
  ".jsx": "JavaScript React", ".py": "Python", ".rs": "Rust",
  ".go": "Go", ".java": "Java", ".c": "C", ".cpp": "C++",
  ".rb": "Ruby", ".php": "PHP", ".swift": "Swift", ".kt": "Kotlin",
  ".html": "HTML", ".css": "CSS", ".md": "Markdown", ".txt": "Plain Text",
  ".pdf": "PDF Document", ".docx": "Word Document", ".doc": "Word Document",
  ".pptx": "PowerPoint", ".ppt": "PowerPoint",
  ".png": "PNG Image", ".jpg": "JPEG Image", ".jpeg": "JPEG Image",
  ".gif": "GIF Image", ".svg": "SVG Image", ".webp": "WebP Image",
  ".mp3": "MP3 Audio", ".wav": "WAV Audio", ".m4a": "M4A Audio",
  ".mp4": "MP4 Video", ".mov": "QuickTime Video", ".avi": "AVI Video",
  ".csv": "CSV Data", ".json": "JSON", ".yaml": "YAML", ".yml": "YAML",
  ".url": "URL Bookmark", ".webloc": "URL Bookmark",
};

export interface DigestOptions {
  filePath: string;
  result: AnalysisResult;
  config: Config;
  sourceHash?: string;
}

export function generateDigest(options: DigestOptions): string {
  const { filePath, result, sourceHash } = options;
  const fileName = basename(filePath);
  const now = new Date().toISOString();
  const fileInfo = getFileInfo(filePath);
  const fileType = extensionToType[fileInfo.extension] || fileInfo.extension || "Unknown";
  const formattedSize = formatFileSize(fileInfo.sizeBytes);
  const modifiedDate = fileInfo.modifiedAt.toISOString();
  const hash = sourceHash ?? getFileHash(filePath);

  const lines: string[] = [
    `# ${fileName}`,
    "",
    `> Auto-generated digest — ${now}`,
    "",
    "## Summary",
    "",
    result.summary || "_No summary available._",
    "",
    "## File Info",
    "",
    `- **Type**: ${fileType}`,
    `- **Size**: ${formattedSize}`,
    `- **Modified**: ${modifiedDate}`,
    `- **Digested**: ${now}`,
    `- **Hash**: ${hash}`,
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

  const fileName = basename(filePath);
  const outputPath = join(config.outputDir, `${fileName}.md`);

  writeFileSync(outputPath, markdown, "utf-8");
  return outputPath;
}

export function deleteDigest(digestPath: string): boolean {
  if (existsSync(digestPath)) {
    unlinkSync(digestPath);
    return true;
  }
  return false;
}
