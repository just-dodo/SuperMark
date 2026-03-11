/**
 * File type detection and metadata utilities.
 */

import { statSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { extname, basename } from "node:path";
import type { FileInfo } from "../analyzers/types.js";

export function getFileInfo(filePath: string): FileInfo {
  const stats = statSync(filePath);
  const extension = extname(filePath).toLowerCase();

  return {
    filePath,
    extension,
    fileName: basename(filePath),
    sizeBytes: stats.size,
    modifiedAt: stats.mtime,
  };
}

export function getFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash("sha256").update(content).digest("hex");
}

export function isHiddenFile(filePath: string): boolean {
  return basename(filePath).startsWith(".");
}

export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}
