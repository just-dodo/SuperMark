import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadConfig } from "../src/config/index.js";

const TEST_CONFIG_PATH = resolve("/tmp/supermark-test.config.json");

afterEach(() => {
  if (existsSync(TEST_CONFIG_PATH)) {
    unlinkSync(TEST_CONFIG_PATH);
  }
});

describe("loadConfig", () => {
  it("returns default config when no file exists", () => {
    const config = loadConfig("/tmp/nonexistent-supermark-config.json");
    expect(config.watchDir).toBe("./inbox");
    expect(config.outputDir).toBe("./digests");
    expect(config.recursive).toBe(true);
    expect(config.concurrency).toBe(3);
    expect(config.debounceMs).toBe(1000);
    expect(config.ignore).toEqual(["*.tmp", ".DS_Store"]);
    expect(config.cleanupDigests).toBe(true);
    expect(config.ai.provider).toBe("openai");
    expect(config.ai.model).toBe("gpt-4o");
    expect(config.ai.whisperModel).toBe("whisper-1");
  });

  it("merges user overrides with defaults", () => {
    writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({ watchDir: "./my-inbox", concurrency: 5 }),
      "utf-8"
    );
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.watchDir).toBe("./my-inbox");
    expect(config.concurrency).toBe(5);
    // Defaults preserved
    expect(config.outputDir).toBe("./digests");
    expect(config.recursive).toBe(true);
  });

  it("AI config merges correctly — partial ai overrides keep defaults", () => {
    writeFileSync(
      TEST_CONFIG_PATH,
      JSON.stringify({ ai: { model: "gpt-4-turbo" } }),
      "utf-8"
    );
    const config = loadConfig(TEST_CONFIG_PATH);
    expect(config.ai.model).toBe("gpt-4-turbo");
    // Other ai defaults preserved
    expect(config.ai.provider).toBe("openai");
    expect(config.ai.whisperModel).toBe("whisper-1");
  });
});
