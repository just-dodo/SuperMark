/**
 * Configuration loading with defaults.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "../analyzers/types.js";

const DEFAULT_CONFIG: Config = {
  watchDir: ".",
  outputDir: ".",
  recursive: true,
  concurrency: 3,
  debounceMs: 1000,
  ignore: ["*.tmp", ".DS_Store", "**/*.md"],
  cleanupDigests: true,
  ai: {
    provider: "openai",
    model: "gpt-4o",
    whisperModel: "whisper-1",
  },
};

export function loadConfig(configPath?: string): Config {
  const resolvedPath = configPath
    ? resolve(configPath)
    : resolve("supermark.config.json");

  if (existsSync(resolvedPath)) {
    const raw = readFileSync(resolvedPath, "utf-8");
    const userConfig = JSON.parse(raw) as Partial<Config>;
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  }

  return { ...DEFAULT_CONFIG };
}

function mergeConfig(base: Config, overrides: Partial<Config>): Config {
  return {
    ...base,
    ...overrides,
    ai: {
      ...base.ai,
      ...(overrides.ai ?? {}),
    },
  };
}

export { DEFAULT_CONFIG };
export type { Config } from "../analyzers/types.js";
