/**
 * Shared types for all analyzers.
 */

export interface AnalysisResult {
  /** Brief summary of the file content */
  summary: string;
  /** Detailed content analysis */
  contentAnalysis: string;
  /** Key details extracted from the file */
  keyDetails: string[];
  /** AI-friendly context for downstream consumption */
  aiContext: string;
  /** Arbitrary metadata specific to the analyzer */
  metadata: Record<string, unknown>;
  /** Original content (text, transcription, extracted text) — included in digest */
  rawContent?: string;
}

export interface FileInfo {
  /** Absolute path to the file */
  filePath: string;
  /** File extension (e.g., ".pdf") */
  extension: string;
  /** File name without path */
  fileName: string;
  /** File size in bytes */
  sizeBytes: number;
  /** MIME type if detected */
  mimeType?: string;
  /** Last modified timestamp */
  modifiedAt: Date;
}

export type AnalyzerFn = (filePath: string, config: Config) => Promise<AnalysisResult>;

export interface Config {
  watchDir: string;
  outputDir: string;
  recursive: boolean;
  concurrency: number;
  debounceMs: number;
  ignore: string[];
  cleanupDigests: boolean;
  ai: AiConfig;
}

export interface AiConfig {
  provider: string;
  model: string;
  whisperModel: string;
}
