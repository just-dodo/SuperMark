/**
 * CSV, JSON, and YAML data file analyzer.
 */

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import { parse as csvParse } from "csv-parse/sync";
import yaml from "js-yaml";
import { callLlm } from "../ai/llm.js";
import type { AnalysisResult, Config } from "./types.js";

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

interface ColumnType {
  name: string;
  type: "number" | "boolean" | "date" | "string";
}

function detectColumnTypes(rows: Record<string, unknown>[], headers: string[]): ColumnType[] {
  const types: ColumnType[] = headers.map((header) => ({
    name: header,
    type: "string",
  }));

  if (rows.length === 0) return types;

  // Sample up to 20 rows to detect types
  const sampleSize = Math.min(20, rows.length);
  for (let i = 0; i < sampleSize; i++) {
    const row = rows[i];
    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = row[header];

      if (value === null || value === undefined || value === "") continue;

      const str = String(value).trim();
      if (str === "") continue;

      // Already detected as string, skip
      if (types[j].type === "string") continue;

      // Try to detect type
      if (!Number.isNaN(Number(str))) {
        types[j].type = "number";
      } else if (str.toLowerCase() === "true" || str.toLowerCase() === "false") {
        types[j].type = "boolean";
      } else if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        types[j].type = "date";
      } else {
        types[j].type = "string";
      }
    }
  }

  return types;
}

async function analyzeCsv(
  filePath: string,
  content: string,
  config: Config,
): Promise<AnalysisResult> {
  let rows: Record<string, unknown>[] = [];
  const headers: string[] = [];

  try {
    rows = csvParse(content, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
    }) as Record<string, unknown>[];
  } catch (error) {
    return {
      summary: `CSV parsing error in ${basename(filePath)}`,
      contentAnalysis: `Failed to parse CSV: ${error instanceof Error ? error.message : String(error)}`,
      keyDetails: ["CSV parsing failed"],
      aiContext: `CSV file at ${filePath} could not be parsed.`,
      metadata: { format: "csv", error: true },
    };
  }

  if (rows.length === 0) {
    return {
      summary: `Empty CSV file: ${basename(filePath)}`,
      contentAnalysis: "CSV file contains no data rows.",
      keyDetails: ["File is empty"],
      aiContext: `Empty CSV file at ${filePath}.`,
      metadata: { format: "csv", rowCount: 0 },
    };
  }

  const firstRow = rows[0];
  Object.keys(firstRow).forEach((key) => {
    if (key) headers.push(key);
  });

  const columnTypes = detectColumnTypes(rows, headers);
  const sampleRows = rows.slice(0, 5);

  const schemaDescription = columnTypes.map((ct) => `${ct.name} (${ct.type})`).join(", ");
  const sampleData = JSON.stringify(sampleRows, null, 2).slice(0, 1000);

  const prompt = `Analyze this CSV data and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this CSV contains
- "contentAnalysis": Breakdown of the data structure, column purposes, and data quality observations
- "keyDetails": Array of strings describing notable aspects (column count, row count, data types, potential issues)
- "aiContext": A concise description optimized for AI consumption

CSV Schema: ${schemaDescription}
Row Count: ${rows.length}

Sample Data (first 5 rows):
\`\`\`json
${sampleData}
\`\`\``;

  const systemPrompt =
    "You are a data analysis expert. Analyze CSV structure and content. Respond only with valid JSON, never with markdown code fences or extra text.";

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
    summary: parsed.summary ?? `CSV data: ${basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: parsed.keyDetails ?? [],
    aiContext: parsed.aiContext ?? "",
    rawContent: content,
    metadata: {
      format: "csv",
      rowCount: rows.length,
      columnCount: headers.length,
      columns: headers,
      columnTypes,
    },
  };
}

async function analyzeJson(
  filePath: string,
  content: string,
  config: Config,
): Promise<AnalysisResult> {
  let data: unknown;

  try {
    data = JSON.parse(content);
  } catch (error) {
    return {
      summary: `JSON parsing error in ${basename(filePath)}`,
      contentAnalysis: `Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`,
      keyDetails: ["JSON parsing failed"],
      aiContext: `JSON file at ${filePath} could not be parsed.`,
      metadata: { format: "json", error: true },
    };
  }

  let structureDescription = "";
  let sampleData = "";
  let recordCount = 0;
  let topLevelKeys: string[] = [];

  if (Array.isArray(data)) {
    recordCount = data.length;
    if (recordCount > 0) {
      const firstElement = data[0];
      if (typeof firstElement === "object" && firstElement !== null) {
        topLevelKeys = Object.keys(firstElement as Record<string, unknown>);
        structureDescription = `Array of ${recordCount} objects with keys: ${topLevelKeys.join(", ")}`;
      } else {
        structureDescription = `Array of ${recordCount} ${typeof firstElement} values`;
      }
      sampleData = JSON.stringify(data.slice(0, 3), null, 2);
    } else {
      structureDescription = "Empty array";
    }
  } else if (typeof data === "object" && data !== null) {
    topLevelKeys = Object.keys(data as Record<string, unknown>);
    structureDescription = `Object with top-level keys: ${topLevelKeys.join(", ")}`;
    sampleData = JSON.stringify(data, null, 2).slice(0, 2000);
  } else {
    structureDescription = `${typeof data} value`;
    sampleData = JSON.stringify(data);
  }

  const prompt = `Analyze this JSON data and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this JSON contains
- "contentAnalysis": Breakdown of the data structure, key objects/arrays, and data organization
- "keyDetails": Array of strings describing notable aspects (record count, key fields, structure patterns)
- "aiContext": A concise description optimized for AI consumption

JSON Structure: ${structureDescription}

Sample Data:
\`\`\`json
${sampleData}
\`\`\``;

  const systemPrompt =
    "You are a data analysis expert. Analyze JSON structure and content. Respond only with valid JSON, never with markdown code fences or extra text.";

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
    summary: parsed.summary ?? `JSON data: ${basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: parsed.keyDetails ?? [],
    aiContext: parsed.aiContext ?? "",
    rawContent: content,
    metadata: {
      format: "json",
      recordCount: Array.isArray(data) ? recordCount : undefined,
      topLevelKeys,
      isArray: Array.isArray(data),
    },
  };
}

async function analyzeYaml(
  filePath: string,
  content: string,
  config: Config,
): Promise<AnalysisResult> {
  let data: unknown;

  try {
    data = yaml.load(content);
  } catch (error) {
    return {
      summary: `YAML parsing error in ${basename(filePath)}`,
      contentAnalysis: `Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`,
      keyDetails: ["YAML parsing failed"],
      aiContext: `YAML file at ${filePath} could not be parsed.`,
      metadata: { format: "yaml", error: true },
    };
  }

  let structureDescription = "";
  let sampleData = "";
  let topLevelKeys: string[] = [];

  if (Array.isArray(data)) {
    const count = data.length;
    if (count > 0) {
      const firstElement = data[0];
      if (typeof firstElement === "object" && firstElement !== null) {
        topLevelKeys = Object.keys(firstElement as Record<string, unknown>);
        structureDescription = `Array of ${count} objects with keys: ${topLevelKeys.join(", ")}`;
      } else {
        structureDescription = `Array of ${count} ${typeof firstElement} values`;
      }
      sampleData = JSON.stringify(data.slice(0, 3), null, 2);
    } else {
      structureDescription = "Empty array";
    }
  } else if (typeof data === "object" && data !== null) {
    topLevelKeys = Object.keys(data as Record<string, unknown>);
    structureDescription = `Object with top-level keys: ${topLevelKeys.join(", ")}`;
    sampleData = JSON.stringify(data, null, 2).slice(0, 2000);
  } else {
    structureDescription = `${typeof data} value`;
    sampleData = JSON.stringify(data);
  }

  const prompt = `Analyze this YAML data and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this YAML contains
- "contentAnalysis": Breakdown of the data structure, configuration sections, and organization
- "keyDetails": Array of strings describing notable aspects (key sections, configuration groups, structure)
- "aiContext": A concise description optimized for AI consumption

YAML Structure: ${structureDescription}

Sample Data:
\`\`\`json
${sampleData}
\`\`\``;

  const systemPrompt =
    "You are a configuration and data analysis expert. Analyze YAML structure and content. Respond only with valid JSON, never with markdown code fences or extra text.";

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
    summary: parsed.summary ?? `YAML data: ${basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: parsed.keyDetails ?? [],
    aiContext: parsed.aiContext ?? "",
    rawContent: content,
    metadata: {
      format: "yaml",
      topLevelKeys,
      isArray: Array.isArray(data),
    },
  };
}

async function analyzeXml(
  filePath: string,
  content: string,
  config: Config,
): Promise<AnalysisResult> {
  const rootMatch = content.match(/<(\w+)/);
  const rootElement = rootMatch ? rootMatch[1] : "unknown";
  const tagCount = (content.match(/<\w+/g) || []).length;
  const textContent = content.replace(/<[^>]+>/g, "").trim().slice(0, 500);

  const prompt = `Analyze this XML data and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this XML contains
- "contentAnalysis": Breakdown of the XML structure, root element, and key sections
- "keyDetails": Array of strings describing notable aspects (root element, tag count, content)
- "aiContext": A concise description optimized for AI consumption

XML Root Element: ${rootElement}
Tag Count: ${tagCount}
Text Content Sample:
\`\`\`
${textContent}
\`\`\``;

  const systemPrompt =
    "You are an XML and data analysis expert. Analyze XML structure and content. Respond only with valid JSON, never with markdown code fences or extra text.";

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
    summary: parsed.summary ?? `XML data: ${basename(filePath)}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: parsed.keyDetails ?? [],
    aiContext: parsed.aiContext ?? "",
    rawContent: content,
    metadata: {
      format: "xml",
      rootElement,
      tagCount,
    },
  };
}

export async function analyzeData(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  const ext = extname(filePath).toLowerCase();
  const content = readFileSync(filePath, "utf-8");

  switch (ext) {
    case ".csv":
      return analyzeCsv(filePath, content, config);
    case ".json":
    case ".jsonc":
      return analyzeJson(filePath, content, config);
    case ".yaml":
    case ".yml":
      return analyzeYaml(filePath, content, config);
    case ".xml":
      return analyzeXml(filePath, content, config);
    default:
      return {
        summary: `Unsupported data format: ${basename(filePath)}`,
        contentAnalysis: "File format is not recognized as a data file.",
        keyDetails: [`File extension: ${ext}`],
        aiContext: `Data file at ${filePath} with unrecognized format.`,
        rawContent: content,
        metadata: { format: "unknown", extension: ext },
      };
  }
}
