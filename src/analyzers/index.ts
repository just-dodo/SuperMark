/**
 * Analyzer registry: maps file extensions to the appropriate analyzer function.
 */

import type { AnalyzerFn, AnalysisResult, Config } from "./types.js";
import { analyzeText } from "./text.js";
import { analyzeDocument } from "./document.js";
import { analyzePresentation } from "./presentation.js";
import { analyzeImage } from "./image.js";
import { analyzeAudio } from "./audio.js";
import { analyzeVideo } from "./video.js";
import { analyzeUrl } from "./url.js";
import { analyzeData } from "./data.js";
import { analyzeBinary } from "./binary.js";

const extensionMap: Record<string, AnalyzerFn> = {
  // Text and code
  ".txt": analyzeText,
  ".md": analyzeText,
  ".ts": analyzeText,
  ".tsx": analyzeText,
  ".js": analyzeText,
  ".jsx": analyzeText,
  ".py": analyzeText,
  ".rs": analyzeText,
  ".go": analyzeText,
  ".java": analyzeText,
  ".c": analyzeText,
  ".cpp": analyzeText,
  ".h": analyzeText,
  ".css": analyzeText,
  ".html": analyzeText,
  ".sh": analyzeText,
  ".bash": analyzeText,
  ".zsh": analyzeText,
  ".swift": analyzeText,
  ".kt": analyzeText,
  ".rb": analyzeText,
  ".php": analyzeText,
  ".sql": analyzeText,
  ".r": analyzeText,
  ".lua": analyzeText,

  // Documents
  ".pdf": analyzeDocument,
  ".docx": analyzeDocument,
  ".doc": analyzeDocument,

  // Presentations
  ".pptx": analyzePresentation,
  ".ppt": analyzePresentation,

  // Images
  ".png": analyzeImage,
  ".jpg": analyzeImage,
  ".jpeg": analyzeImage,
  ".gif": analyzeImage,
  ".webp": analyzeImage,
  ".svg": analyzeImage,
  ".bmp": analyzeImage,
  ".tiff": analyzeImage,

  // Audio
  ".mp3": analyzeAudio,
  ".wav": analyzeAudio,
  ".flac": analyzeAudio,
  ".aac": analyzeAudio,
  ".ogg": analyzeAudio,
  ".m4a": analyzeAudio,
  ".wma": analyzeAudio,

  // Video
  ".mp4": analyzeVideo,
  ".mkv": analyzeVideo,
  ".avi": analyzeVideo,
  ".mov": analyzeVideo,
  ".webm": analyzeVideo,
  ".wmv": analyzeVideo,
  ".flv": analyzeVideo,

  // URL bookmarks
  ".url": analyzeUrl,
  ".webloc": analyzeUrl,

  // Data
  ".json": analyzeData,
  ".csv": analyzeData,
  ".tsv": analyzeData,
  ".yaml": analyzeData,
  ".yml": analyzeData,
  ".xml": analyzeData,
  ".xlsx": analyzeData,
  ".xls": analyzeData,
};

/**
 * Route a file to the appropriate analyzer based on its extension.
 */
export function route(extension: string): AnalyzerFn {
  const normalized = extension.toLowerCase();
  return extensionMap[normalized] ?? analyzeBinary;
}

/**
 * Analyze a file by routing it to the correct analyzer.
 */
export async function analyze(
  filePath: string,
  extension: string,
  config: Config,
): Promise<AnalysisResult> {
  const analyzer = route(extension);
  return analyzer(filePath, config);
}

export { extensionMap };
export type { AnalysisResult, AnalyzerFn, FileInfo, Config } from "./types.js";
