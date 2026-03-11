/**
 * DigestTracker — tracks digested files and their content hashes.
 * Persists tracking data to <outputDir>/.supermark-tracker.json
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

interface DigestRecord {
  sourceHash: string;
  digestPath: string;
  digestedAt: string;
}

export class DigestTracker {
  private records: Record<string, DigestRecord> = {};
  private trackerPath: string;

  constructor(outputDir: string) {
    mkdirSync(outputDir, { recursive: true });
    this.trackerPath = join(outputDir, ".supermark-tracker.json");
    this.load();
  }

  private load(): void {
    if (existsSync(this.trackerPath)) {
      try {
        const raw = readFileSync(this.trackerPath, "utf-8");
        this.records = JSON.parse(raw) as Record<string, DigestRecord>;
      } catch {
        this.records = {};
      }
    }
  }

  private save(): void {
    writeFileSync(this.trackerPath, JSON.stringify(this.records, null, 2), "utf-8");
  }

  track(sourcePath: string, sourceHash: string, digestPath: string): void {
    this.records[sourcePath] = {
      sourceHash,
      digestPath,
      digestedAt: new Date().toISOString(),
    };
    this.save();
  }

  needsDigestion(sourcePath: string, currentHash: string): boolean {
    const record = this.records[sourcePath];
    if (!record) return true;
    return record.sourceHash !== currentHash;
  }

  getDigestPath(sourcePath: string): string | undefined {
    return this.records[sourcePath]?.digestPath;
  }

  remove(sourcePath: string, deleteDigest = false): void {
    const record = this.records[sourcePath];
    if (record && deleteDigest) {
      if (existsSync(record.digestPath)) {
        unlinkSync(record.digestPath);
      }
    }
    delete this.records[sourcePath];
    this.save();
  }

  getTrackedPaths(): string[] {
    return Object.keys(this.records);
  }
}
