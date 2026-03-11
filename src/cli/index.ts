#!/usr/bin/env node

/**
 * SuperMark CLI — AI-powered file digestion system.
 */

import { Command } from "commander";
import { loadConfig } from "../config/index.js";
import { startWatcher, stopWatcher } from "../watcher/index.js";
import { createQueue, enqueue } from "../queue/index.js";
import { analyze } from "../analyzers/index.js";
import { writeDigest } from "../generator/index.js";
import { getFileInfo } from "../utils/file.js";

const program = new Command();

program
  .name("supermark")
  .description("AI-powered file digestion system — auto-generates markdown documentation for every file")
  .version("0.1.0");

program
  .command("watch")
  .description("Watch a directory and auto-generate digests for new files")
  .option("-c, --config <path>", "Path to config file")
  .action(async (options: { config?: string }) => {
    const config = loadConfig(options.config);
    const queue = createQueue(config);

    console.log(`Watching ${config.watchDir} for new files...`);

    const watcher = startWatcher(config, {
      onFileAdded: (filePath) => {
        console.log(`New file detected: ${filePath}`);
        const fileInfo = getFileInfo(filePath);
        void enqueue(queue, { filePath, addedAt: new Date() }, async () => {
          const result = await analyze(filePath, fileInfo.extension, config);
          const outputPath = writeDigest({ filePath, result, config });
          console.log(`Digest written: ${outputPath}`);
        });
      },
      onReady: () => {
        console.log("Watcher ready.");
      },
      onError: (error) => {
        console.error("Watcher error:", error.message);
      },
    });

    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      void stopWatcher(watcher).then(() => process.exit(0));
    });
  });

program
  .command("digest <file>")
  .description("Generate a digest for a single file")
  .option("-c, --config <path>", "Path to config file")
  .action(async (file: string, options: { config?: string }) => {
    const config = loadConfig(options.config);
    const fileInfo = getFileInfo(file);
    const result = await analyze(file, fileInfo.extension, config);
    const outputPath = writeDigest({ filePath: file, result, config });
    console.log(`Digest written: ${outputPath}`);
  });

program
  .command("init")
  .description("Initialize a supermark project with default config")
  .action(async () => {
    const { writeFileSync, mkdirSync } = await import("node:fs");
    const { DEFAULT_CONFIG } = await import("../config/index.js");

    writeFileSync("supermark.config.json", JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
    mkdirSync(DEFAULT_CONFIG.watchDir, { recursive: true });
    mkdirSync(DEFAULT_CONFIG.outputDir, { recursive: true });
    console.log("Initialized supermark project.");
    console.log(`  Config: supermark.config.json`);
    console.log(`  Watch dir: ${DEFAULT_CONFIG.watchDir}`);
    console.log(`  Output dir: ${DEFAULT_CONFIG.outputDir}`);
  });

program
  .command("status")
  .description("Show current supermark status")
  .option("-c, --config <path>", "Path to config file")
  .action((options: { config?: string }) => {
    const config = loadConfig(options.config);
    console.log("SuperMark Status");
    console.log(`  Watch dir:   ${config.watchDir}`);
    console.log(`  Output dir:  ${config.outputDir}`);
    console.log(`  Concurrency: ${config.concurrency}`);
    console.log(`  AI provider: ${config.ai.provider}`);
    console.log(`  AI model:    ${config.ai.model}`);
  });

program.parse();
