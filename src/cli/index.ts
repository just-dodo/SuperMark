#!/usr/bin/env node

/**
 * SuperMark CLI — AI-powered file digestion system.
 */

import { Command } from "commander";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config/index.js";
import { startWatcher, stopWatcher } from "../watcher/index.js";
import { createQueue, enqueue } from "../queue/index.js";
import { analyze } from "../analyzers/index.js";
import { writeDigest } from "../generator/index.js";
import { getFileInfo, getFileHash } from "../utils/file.js";
import { DigestTracker } from "../digest-tracker.js";

const program = new Command();

program
  .name("supermark")
  .description("AI-powered file digestion system — auto-generates markdown documentation for every file")
  .version("0.1.0");

program
  .command("watch")
  .description("Watch a directory and auto-generate digests for new files")
  .option("-c, --config <path>", "Path to config file")
  .option("-d, --daemon", "Run in background as a daemon process")
  .action(async (options: { config?: string; daemon?: boolean }) => {
    if (options.daemon) {
      const { spawn } = await import("node:child_process");
      const { writeFileSync } = await import("node:fs");

      // Re-run the same command without --daemon
      const args = process.argv.slice(1).filter(a => a !== "--daemon" && a !== "-d");
      const child = spawn(process.argv[0], args, {
        detached: true,
        stdio: "ignore",
      });
      child.unref();

      writeFileSync(".supermark.pid", String(child.pid));
      console.log(`SuperMark daemon started (PID: ${child.pid})`);
      console.log("  PID file: .supermark.pid");
      console.log("  Stop with: supermark stop");
      process.exit(0);
    }

    const config = loadConfig(options.config);
    const queue = createQueue(config);
    const tracker = new DigestTracker(config.outputDir);

    console.log(`Watching ${config.watchDir} for new files...`);

    const digestFile = async (filePath: string) => {
      const fileInfo = getFileInfo(filePath);
      const hash = getFileHash(filePath);
      if (!tracker.needsDigestion(filePath, hash)) {
        return;
      }
      const result = await analyze(filePath, fileInfo.extension, config);
      const outputPath = writeDigest({ filePath, result, config, sourceHash: hash });
      tracker.track(filePath, hash, outputPath);
      console.log(`Digest written: ${outputPath}`);
    };

    const watcher = startWatcher(config, {
      onFileAdded: (filePath) => {
        console.log(`New file detected: ${filePath}`);
        void enqueue(queue, { filePath, addedAt: new Date() }, () => digestFile(filePath));
      },
      onFileChanged: (filePath) => {
        console.log(`File changed: ${filePath}`);
        void enqueue(queue, { filePath, addedAt: new Date() }, () => digestFile(filePath));
      },
      onFileRemoved: (filePath) => {
        console.log(`File removed: ${filePath}`);
        if (config.cleanupDigests) {
          tracker.remove(filePath, true);
          console.log(`Digest removed for: ${filePath}`);
        } else {
          tracker.remove(filePath, false);
        }
      },
      onReady: () => {
        console.log("Watcher ready. Scanning for undigested files...");

        // Startup scan: find files not yet up-to-date in tracker
        const scanDir = (dir: string) => {
          let entries: string[];
          try {
            entries = readdirSync(dir);
          } catch {
            return;
          }
          for (const entry of entries) {
            const fullPath = join(dir, entry);
            // Skip hidden files/dirs
            if (entry.startsWith(".")) continue;
            // Skip .md files (digests live in same dir as sources)
            if (entry.endsWith(".md")) continue;
            // Skip ignore patterns (basic glob check)
            const ignored = config.ignore.some((pattern) => {
              // Simple wildcard match for *.ext patterns
              if (pattern.startsWith("*")) {
                return entry.endsWith(pattern.slice(1));
              }
              return entry === pattern;
            });
            if (ignored) continue;

            let stat;
            try {
              stat = statSync(fullPath);
            } catch {
              continue;
            }

            if (stat.isDirectory()) {
              if (config.recursive) {
                scanDir(fullPath);
              }
            } else {
              // Skip digest files themselves
              if (fullPath.startsWith(config.outputDir)) continue;
              const hash = getFileHash(fullPath);
              if (tracker.needsDigestion(fullPath, hash)) {
                void enqueue(queue, { filePath: fullPath, addedAt: new Date() }, () => digestFile(fullPath));
              }
            }
          }
        };

        scanDir(config.watchDir);
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
  .command("stop")
  .description("Stop the background SuperMark daemon")
  .action(async () => {
    const { readFileSync, unlinkSync, existsSync } = await import("node:fs");
    const pidFile = ".supermark.pid";
    if (!existsSync(pidFile)) {
      console.log("No running SuperMark daemon found.");
      return;
    }
    const pid = parseInt(readFileSync(pidFile, "utf-8").trim(), 10);
    try {
      process.kill(pid);
      unlinkSync(pidFile);
      console.log(`SuperMark daemon stopped (PID: ${pid})`);
    } catch {
      unlinkSync(pidFile);
      console.log(`Process ${pid} not found. Cleaned up PID file.`);
    }
  });

program
  .command("digest <file>")
  .description("Generate a digest for a single file")
  .option("-c, --config <path>", "Path to config file")
  .action(async (file: string, options: { config?: string }) => {
    const config = loadConfig(options.config);
    const tracker = new DigestTracker(config.outputDir);
    const fileInfo = getFileInfo(file);
    const hash = getFileHash(file);
    const result = await analyze(file, fileInfo.extension, config);
    const outputPath = writeDigest({ filePath: file, result, config, sourceHash: hash });
    tracker.track(file, hash, outputPath);
    console.log(`Digest written: ${outputPath}`);
  });

program
  .command("init")
  .description("Initialize a supermark project with default config")
  .action(async () => {
    const { writeFileSync } = await import("node:fs");
    const { DEFAULT_CONFIG } = await import("../config/index.js");

    writeFileSync("supermark.config.json", JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n");
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
