import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getFileInfo, formatFileSize, isHiddenFile } from "../../src/utils/file.js";

const TEMP_FILE = join(tmpdir(), "supermark-test-file.txt");
const TEMP_CONTENT = "hello world";

beforeAll(() => {
  writeFileSync(TEMP_FILE, TEMP_CONTENT, "utf-8");
});

afterAll(() => {
  unlinkSync(TEMP_FILE);
});

describe("getFileInfo", () => {
  it("returns correct extension, fileName, sizeBytes for a temp file", () => {
    const info = getFileInfo(TEMP_FILE);
    expect(info.extension).toBe(".txt");
    expect(info.fileName).toBe("supermark-test-file.txt");
    expect(info.sizeBytes).toBe(Buffer.byteLength(TEMP_CONTENT, "utf-8"));
    expect(info.filePath).toBe(TEMP_FILE);
  });

  it("returns correct modifiedAt as a Date", () => {
    const info = getFileInfo(TEMP_FILE);
    expect(info.modifiedAt).toBeInstanceOf(Date);
    expect(info.modifiedAt.getTime()).toBeGreaterThan(0);
  });
});

describe("formatFileSize", () => {
  it("formats 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0.0 B");
  });

  it("formats 1024 bytes as 1.0 KB", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
  });

  it("formats 1048576 bytes as 1.0 MB", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
  });

  it("formats 1073741824 bytes as 1.0 GB", () => {
    expect(formatFileSize(1073741824)).toBe("1.0 GB");
  });
});

describe("isHiddenFile", () => {
  it("returns true for .gitignore", () => {
    expect(isHiddenFile(".gitignore")).toBe(true);
  });

  it("returns true for .DS_Store", () => {
    expect(isHiddenFile(".DS_Store")).toBe(true);
  });

  it("returns false for readme.md", () => {
    expect(isHiddenFile("readme.md")).toBe(false);
  });

  it("returns false for app.ts", () => {
    expect(isHiddenFile("app.ts")).toBe(false);
  });
});
