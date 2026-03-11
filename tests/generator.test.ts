import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { generateDigest, writeDigest } from "../src/generator/index.js";
import type { AnalysisResult } from "../src/analyzers/types.js";
import type { Config } from "../src/analyzers/types.js";

const TEMP_FILE = join(tmpdir(), "supermark-gen-test.txt");
const TEMP_OUTPUT_DIR = join(tmpdir(), "supermark-gen-output");

const baseResult: AnalysisResult = {
  summary: "This is a test summary.",
  contentAnalysis: "This is test content analysis.",
  keyDetails: ["detail one", "detail two"],
  aiContext: "This is AI context.",
  metadata: { language: "Plain Text", lineCount: 3 },
};

const baseConfig: Config = {
  watchDir: "./inbox",
  outputDir: TEMP_OUTPUT_DIR,
  recursive: true,
  concurrency: 3,
  debounceMs: 1000,
  ignore: [],
  cleanupDigests: false,
  ai: { provider: "openai", model: "gpt-4o", whisperModel: "whisper-1" },
};

beforeAll(() => {
  writeFileSync(TEMP_FILE, "line1\nline2\nline3", "utf-8");
});

afterAll(() => {
  unlinkSync(TEMP_FILE);
  if (existsSync(TEMP_OUTPUT_DIR)) {
    rmSync(TEMP_OUTPUT_DIR, { recursive: true });
  }
});

describe("generateDigest", () => {
  it("generates markdown with correct heading (filename)", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("# supermark-gen-test.txt");
  });

  it("includes Summary section with content", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## Summary");
    expect(md).toContain("This is a test summary.");
  });

  it("includes File Info section", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## File Info");
    expect(md).toContain("**Type**");
    expect(md).toContain("**Size**");
    expect(md).toContain("**Modified**");
  });

  it("includes Content Analysis section", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## Content Analysis");
    expect(md).toContain("This is test content analysis.");
  });

  it("includes Key Details as bullet points when provided", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## Key Details");
    expect(md).toContain("- detail one");
    expect(md).toContain("- detail two");
  });

  it("includes AI Context when provided", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## AI Context");
    expect(md).toContain("This is AI context.");
  });

  it("includes Metadata as JSON block when provided", () => {
    const md = generateDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(md).toContain("## Metadata");
    expect(md).toContain("```json");
    expect(md).toContain('"language": "Plain Text"');
  });

  it("handles empty keyDetails gracefully", () => {
    const result = { ...baseResult, keyDetails: [] };
    const md = generateDigest({ filePath: TEMP_FILE, result, config: baseConfig });
    expect(md).not.toContain("## Key Details");
  });

  it("handles empty aiContext gracefully", () => {
    const result = { ...baseResult, aiContext: "" };
    const md = generateDigest({ filePath: TEMP_FILE, result, config: baseConfig });
    expect(md).not.toContain("## AI Context");
  });

  it("handles empty metadata gracefully", () => {
    const result = { ...baseResult, metadata: {} };
    const md = generateDigest({ filePath: TEMP_FILE, result, config: baseConfig });
    expect(md).not.toContain("## Metadata");
  });

  it("uses fallback text when summary is empty", () => {
    const result = { ...baseResult, summary: "" };
    const md = generateDigest({ filePath: TEMP_FILE, result, config: baseConfig });
    expect(md).toContain("_No summary available._");
  });
});

describe("writeDigest", () => {
  it("creates output directory if it doesn't exist", () => {
    const uniqueDir = join(tmpdir(), `supermark-write-test-${Date.now()}`);
    const config = { ...baseConfig, outputDir: uniqueDir };
    writeDigest({ filePath: TEMP_FILE, result: baseResult, config });
    expect(existsSync(uniqueDir)).toBe(true);
    rmSync(uniqueDir, { recursive: true });
  });

  it("writes file with .md extension appended to original filename", () => {
    mkdirSync(TEMP_OUTPUT_DIR, { recursive: true });
    const outputPath = writeDigest({ filePath: TEMP_FILE, result: baseResult, config: baseConfig });
    expect(outputPath).toMatch(/supermark-gen-test\.txt\.md$/);
    expect(existsSync(outputPath)).toBe(true);
  });

  it("file content matches generateDigest output", () => {
    mkdirSync(TEMP_OUTPUT_DIR, { recursive: true });
    const options = { filePath: TEMP_FILE, result: baseResult, config: baseConfig };
    const expected = generateDigest(options);
    const outputPath = writeDigest(options);
    const actual = readFileSync(outputPath, "utf-8");
    // Both generated at slightly different times — compare structural parts
    expect(actual).toContain("# supermark-gen-test.txt");
    expect(actual).toContain("## Summary");
    expect(actual).toContain("This is a test summary.");
  });
});
