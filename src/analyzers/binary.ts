/**
 * Binary fallback analyzer for unrecognized file types.
 */

import type { AnalysisResult, Config } from "./types.js";

export async function analyzeBinary(
  filePath: string,
  _config: Config,
): Promise<AnalysisResult> {
  // TODO: Implement basic binary file metadata extraction
  return {
    summary: `Binary analysis placeholder for ${filePath}`,
    contentAnalysis: "",
    keyDetails: [],
    aiContext: "",
    metadata: {},
  };
}
