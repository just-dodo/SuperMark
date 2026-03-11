import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

vi.mock("../../src/ai/llm.js", () => ({
  callLlm: vi.fn().mockResolvedValue({
    content: JSON.stringify({
      summary: "Test summary",
      contentAnalysis: "Test analysis",
      keyDetails: ["detail1", "detail2"],
      aiContext: "Test context",
    }),
  }),
}));

import { analyzeText } from "../../src/analyzers/text.js";
import { callLlm } from "../../src/ai/llm.js";
import type { Config } from "../../src/analyzers/types.js";

const TEMP_TS_FILE = join(tmpdir(), "supermark-text-test.ts");
const TEMP_TS_CONTENT = `export function hello(name: string): string {
  return \`Hello, \${name}!\`;
}`;

const baseConfig: Config = {
  watchDir: "./inbox",
  outputDir: "./digests",
  recursive: true,
  concurrency: 3,
  debounceMs: 1000,
  ignore: [],
  cleanupDigests: false,
  ai: { provider: "openai", model: "gpt-4o", whisperModel: "whisper-1" },
};

beforeAll(() => {
  writeFileSync(TEMP_TS_FILE, TEMP_TS_CONTENT, "utf-8");
});

afterAll(() => {
  unlinkSync(TEMP_TS_FILE);
});

describe("analyzeText", () => {
  it("reads file, sends correct prompt, and parses LLM response", async () => {
    const result = await analyzeText(TEMP_TS_FILE, baseConfig);

    expect(callLlm).toHaveBeenCalled();

    // The prompt should contain the file content
    const callArgs = vi.mocked(callLlm).mock.calls[0][0];
    expect(callArgs.prompt).toContain("hello");
    expect(callArgs.prompt).toContain("TypeScript");

    expect(result.summary).toBe("Test summary");
    expect(result.contentAnalysis).toBe("Test analysis");
    expect(result.keyDetails).toEqual(["detail1", "detail2"]);
    expect(result.aiContext).toBe("Test context");
  });

  it("populates metadata with language, lineCount, charCount", async () => {
    const result = await analyzeText(TEMP_TS_FILE, baseConfig);
    expect(result.metadata.language).toBe("TypeScript");
    expect(result.metadata.lineCount).toBeGreaterThan(0);
    expect(result.metadata.charCount).toBe(TEMP_TS_CONTENT.length);
  });

  it("falls back gracefully when LLM returns non-JSON", async () => {
    vi.mocked(callLlm).mockResolvedValueOnce({
      content: "This is not JSON at all, just plain text response.",
    });

    const result = await analyzeText(TEMP_TS_FILE, baseConfig);

    // Fallback: summary is first 500 chars of content
    expect(result.summary).toContain("This is not JSON");
    expect(result.keyDetails).toEqual([]);
    expect(result.contentAnalysis).toBe("This is not JSON at all, just plain text response.");
  });
});
