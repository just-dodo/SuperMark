/**
 * Text and code file analyzer.
 */

import * as fs from "fs";
import * as path from "path";
import type { AnalysisResult, Config } from "./types.js";
import { callLlm } from "../ai/llm.js";

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (React)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (React)",
  ".mjs": "JavaScript (ESM)",
  ".cjs": "JavaScript (CommonJS)",
  ".py": "Python",
  ".rb": "Ruby",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C",
  ".cpp": "C++",
  ".cc": "C++",
  ".h": "C/C++ Header",
  ".hpp": "C++ Header",
  ".cs": "C#",
  ".php": "PHP",
  ".sh": "Shell",
  ".bash": "Bash",
  ".zsh": "Zsh",
  ".fish": "Fish",
  ".ps1": "PowerShell",
  ".md": "Markdown",
  ".mdx": "MDX",
  ".txt": "Plain Text",
  ".json": "JSON",
  ".jsonc": "JSON with Comments",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".toml": "TOML",
  ".xml": "XML",
  ".html": "HTML",
  ".htm": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sass": "Sass",
  ".less": "Less",
  ".sql": "SQL",
  ".graphql": "GraphQL",
  ".gql": "GraphQL",
  ".proto": "Protocol Buffers",
  ".tf": "Terraform",
  ".hcl": "HCL",
  ".dockerfile": "Dockerfile",
  ".env": "Environment Variables",
  ".ini": "INI",
  ".cfg": "Config",
  ".conf": "Config",
  ".r": "R",
  ".scala": "Scala",
  ".lua": "Lua",
  ".vim": "Vim Script",
  ".el": "Emacs Lisp",
  ".clj": "Clojure",
  ".ex": "Elixir",
  ".exs": "Elixir Script",
  ".erl": "Erlang",
  ".dart": "Dart",
  ".svelte": "Svelte",
  ".vue": "Vue",
};

const MAX_CONTENT_CHARS = 50000;

function detectLanguage(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  if (basename === "dockerfile") return "Dockerfile";
  if (basename === "makefile") return "Makefile";
  if (basename === "gemfile") return "Ruby (Gemfile)";
  if (basename === "rakefile") return "Ruby (Rakefile)";
  if (basename === "jenkinsfile") return "Jenkinsfile (Groovy)";

  return EXTENSION_LANGUAGE_MAP[ext] ?? "Text";
}

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

export async function analyzeText(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const rawContent = fs.readFileSync(filePath, "utf-8");
  const language = detectLanguage(filePath);
  const charCount = rawContent.length;
  const lineCount = rawContent.split("\n").length;

  let content = rawContent;
  let truncated = false;
  if (content.length > MAX_CONTENT_CHARS) {
    content =
      content.slice(0, MAX_CONTENT_CHARS) +
      "\n\n[Content truncated — file exceeds 50,000 characters]";
    truncated = true;
  }

  const prompt = `Analyze this ${language} file and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this file does
- "contentAnalysis": Detailed breakdown of the file structure, key components (functions, classes, exports, imports)
- "keyDetails": Array of strings describing notable aspects (dependencies, patterns, potential issues)
- "aiContext": A concise description optimized for AI consumption

File content:
\`\`\`
${content}
\`\`\``;

  const systemPrompt =
    "You are a code and text analysis expert. Analyze files thoroughly and respond only with valid JSON, never with markdown code fences or extra text.";

  const response = await callLlm(
    { prompt, systemPrompt, maxTokens: 2000 },
    config,
  );

  let parsed: LlmAnalysisJson = {};
  try {
    // Strip markdown code fences if present
    let raw = response.content.trim();
    const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      raw = fenceMatch[1].trim();
    }
    parsed = JSON.parse(raw) as LlmAnalysisJson;
  } catch {
    // Fallback: construct a basic result from raw text
    parsed = {
      summary: response.content.slice(0, 500),
      contentAnalysis: response.content,
      keyDetails: [],
      aiContext: response.content.slice(0, 200),
    };
  }

  return {
    summary: parsed.summary ?? `Analysis of ${path.basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails) ? parsed.keyDetails : [],
    aiContext: parsed.aiContext ?? "",
    rawContent: rawContent,
    metadata: {
      language,
      lineCount,
      charCount,
      truncated,
    },
  };
}
