/**
 * Markdown digest generator — converts analysis results to markdown files.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
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

function loadTemplate(): string | null {
  const templatePath = resolve("DIGEST_TEMPLATE.md");
  if (existsSync(templatePath)) {
    return readFileSync(templatePath, "utf-8");
  }
  return null;
}

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Split into sections at ## headings and remove empty ones
  const parts = result.split(/(?=^## )/m);
  const filtered = parts.filter((part) => {
    if (!part.startsWith("## ")) return true;
    const afterHeading = part.replace(/^## [^\n]+\n*/, "");
    return afterHeading.trim().length > 0;
  });
  result = filtered.join("");
  // Clean up multiple blank lines
  result = result.replace(/\n{3,}/g, "\n\n");
  return result.trimEnd() + "\n";
}

export interface DigestOptions {
  filePath: string;
  result: AnalysisResult;
  config: Config;
  sourceHash?: string;
  /** Original source path or URL (shown in digest) */
  sourcePath?: string;
}

function ensureString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return JSON.stringify(value, null, 2);
}

export function generateDigest(options: DigestOptions): string {
  const { filePath, result, sourceHash, sourcePath } = options;
  const fileName = basename(filePath);
  const now = new Date().toISOString();

  let fileType = "Unknown";
  let formattedSize = "N/A";
  let modifiedDate = now;
  let hash = sourceHash ?? "";

  try {
    const fileInfo = getFileInfo(filePath);
    fileType = extensionToType[fileInfo.extension] || fileInfo.extension || "Unknown";
    formattedSize = formatFileSize(fileInfo.sizeBytes);
    modifiedDate = fileInfo.modifiedAt.toISOString();
    if (!hash) hash = getFileHash(filePath);
  } catch {
    // File may not exist (e.g. URL digests) — use defaults
    const ext = extname(filePath);
    fileType = extensionToType[ext] || ext || "Unknown";
  }

  const template = loadTemplate();

  if (template !== null) {
    const keyDetailsStr =
      result.keyDetails.length > 0
        ? result.keyDetails.map((d) => `- ${d}`).join("\n")
        : "";
    const metadataStr =
      Object.keys(result.metadata).length > 0
        ? "```json\n" + JSON.stringify(result.metadata, null, 2) + "\n```"
        : "";

    const vars: Record<string, string> = {
      fileName,
      digestedAt: now,
      sourcePath: sourcePath || filePath,
      summary: ensureString(result.summary) || "_No summary available._",
      fileType,
      fileSize: formattedSize,
      modifiedAt: modifiedDate,
      hash,
      contentAnalysis: ensureString(result.contentAnalysis) || "_No content analysis available._",
      keyDetails: keyDetailsStr,
      aiContext: ensureString(result.aiContext) || "",
      metadata: metadataStr,
      rawContent: result.rawContent ? "```\n" + result.rawContent + "\n```" : "",
    };

    return renderTemplate(template, vars);
  }

  // Fallback: hardcoded format
  const lines: string[] = [
    `# ${fileName}`,
    "",
    `> Auto-generated digest — ${now}`,
    "",
    `- **Source**: ${sourcePath || filePath}`,
    "",
    "## Summary",
    "",
    ensureString(result.summary) || "_No summary available._",
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
    ensureString(result.contentAnalysis) || "_No content analysis available._",
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

  if (result.rawContent) {
    lines.push("## Original Content", "");
    lines.push("```");
    lines.push(result.rawContent);
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
