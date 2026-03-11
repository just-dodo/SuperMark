/**
 * Binary fallback analyzer for unrecognized file types.
 */

import { readFileSync, statSync } from "node:fs";
import { basename } from "node:path";
import { formatFileSize } from "../utils/file.js";
import type { AnalysisResult, Config } from "./types.js";

interface MagicBytesMapping {
  bytes: number[];
  type: string;
}

const MAGIC_BYTES_MAP: MagicBytesMapping[] = [
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: "PNG Image" },
  { bytes: [0xff, 0xd8, 0xff], type: "JPEG Image" },
  { bytes: [0x47, 0x49, 0x46], type: "GIF Image" },
  { bytes: [0x25, 0x50, 0x44, 0x46], type: "PDF Document" },
  { bytes: [0x50, 0x4b, 0x03, 0x04], type: "ZIP/Office Document" },
  { bytes: [0x50, 0x4b], type: "ZIP Archive" },
  { bytes: [0x1f, 0x8b], type: "GZIP Compressed" },
  { bytes: [0x42, 0x5a], type: "BZIP2 Compressed" },
  { bytes: [0x37, 0x7a, 0x42, 0x58], type: "7z Compressed" },
  { bytes: [0xd0, 0xcf, 0x11, 0xe0], type: "Microsoft Office (OLE)" },
  { bytes: [0xca, 0xfe, 0xba, 0xbe], type: "Java Class File" },
  { bytes: [0x7f, 0x45, 0x4c, 0x46], type: "ELF Binary" },
  { bytes: [0xfe, 0xed, 0xfa], type: "Mach-O Binary" },
  { bytes: [0x4d, 0x5a], type: "Windows Executable (PE)" },
  { bytes: [0xff, 0xfb], type: "MP3 Audio" },
  { bytes: [0x49, 0x44, 0x33], type: "MP3 Audio (ID3)" },
  { bytes: [0x66, 0x74, 0x79, 0x70], type: "MP4/ISOM Media" },
  { bytes: [0x52, 0x49, 0x46, 0x46], type: "WAV/AVI Media" },
];

function detectFileType(magicBytes: number[]): string {
  for (const mapping of MAGIC_BYTES_MAP) {
    if (mapping.bytes.length > magicBytes.length) continue;

    let match = true;
    for (let i = 0; i < mapping.bytes.length; i++) {
      if (magicBytes[i] !== mapping.bytes[i]) {
        match = false;
        break;
      }
    }

    if (match) {
      return mapping.type;
    }
  }

  return "Unknown Binary";
}

export async function analyzeBinary(
  filePath: string,
  _config: Config,
): Promise<AnalysisResult> {
  try {
    const stats = statSync(filePath);
    const sizeBytes = stats.size;
    const formattedSize = formatFileSize(sizeBytes);
    const createdAt = stats.birthtime;
    const modifiedAt = stats.mtime;
    const fileName = basename(filePath);

    // Read first 16 bytes for magic bytes detection
    const buffer = Buffer.alloc(16);
    const fd = require("node:fs").openSync(filePath, "r");
    const bytesRead = require("node:fs").readSync(fd, buffer, 0, 16, 0);
    require("node:fs").closeSync(fd);

    const magicBytes = Array.from(buffer.slice(0, Math.min(bytesRead, 16)));
    const detectedType = detectFileType(magicBytes);
    const hexSignature = magicBytes.slice(0, 8).map((b) => `${b.toString(16).padStart(2, "0").toUpperCase()}`).join(" ");

    return {
      summary: `Binary file: ${fileName} (${detectedType}, ${formattedSize})`,
      contentAnalysis: `Binary file of type ${detectedType}. Content cannot be directly analyzed as text.`,
      keyDetails: [
        `File type: ${detectedType}`,
        `Size: ${formattedSize}`,
        `Magic bytes: ${hexSignature}`,
        `Created: ${createdAt.toISOString()}`,
        `Modified: ${modifiedAt.toISOString()}`,
      ],
      aiContext: `Binary file at ${filePath}. Type: ${detectedType}, Size: ${formattedSize}. No text content available.`,
      metadata: {
        detectedType,
        magicBytes: hexSignature,
        sizeBytes,
        formattedSize,
        createdAt: createdAt.toISOString(),
        modifiedAt: modifiedAt.toISOString(),
      },
    };
  } catch (error) {
    return {
      summary: `Error analyzing binary file: ${basename(filePath)}`,
      contentAnalysis: `Failed to analyze binary file: ${error instanceof Error ? error.message : String(error)}`,
      keyDetails: ["Binary file analysis failed"],
      aiContext: `Binary file at ${filePath} could not be analyzed.`,
      metadata: { error: true, errorMessage: error instanceof Error ? error.message : String(error) },
    };
  }
}
