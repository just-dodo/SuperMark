/**
 * URL and web page analyzer.
 */

import { readFileSync } from "node:fs";
import { extname, basename } from "node:path";
import * as cheerio from "cheerio";
import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import { callLlm } from "../ai/llm.js";
import type { AnalysisResult, Config } from "./types.js";

const FETCH_TIMEOUT_MS = 30000;
const MAX_CONTENT_CHARS = 50000;

interface LlmAnalysisJson {
  summary?: string;
  contentAnalysis?: string;
  keyDetails?: string[];
  aiContext?: string;
}

function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(url);
}

function extractUrlFromFile(filePath: string): string | null {
  const ext = extname(filePath).toLowerCase();

  if (ext === ".url") {
    // Windows Internet Shortcut format
    try {
      const content = readFileSync(filePath, "utf-8");
      const match = content.match(/URL=(.+)/i);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  if (ext === ".webloc") {
    // macOS web location format
    try {
      const content = readFileSync(filePath, "utf-8");
      const match = content.match(/<string>(.+?)<\/string>/);
      return match ? match[1].trim() : null;
    } catch {
      return null;
    }
  }

  return null;
}

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?.*v=([^&]+)/,
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function callLlmAnalysis(
  text: string,
  context: string,
  config: Config,
): Promise<LlmAnalysisJson> {
  const truncated =
    text.length > MAX_CONTENT_CHARS
      ? text.slice(0, MAX_CONTENT_CHARS) +
        "\n\n[Content truncated — exceeds 50,000 characters]"
      : text;

  const prompt = `Analyze this ${context} and respond ONLY with valid JSON (no markdown, no code blocks) with exactly these fields:
- "summary": One paragraph describing what this content is about
- "contentAnalysis": Detailed breakdown of the main topics, key points, and structure
- "keyDetails": Array of strings describing notable aspects, facts, or takeaways
- "aiContext": A concise description optimized for AI consumption

Content:
${truncated}`;

  const systemPrompt =
    "You are a content analysis expert. Analyze web content thoroughly and respond only with valid JSON, never with markdown code fences or extra text.";

  const response = await callLlm(
    { prompt, systemPrompt, maxTokens: 2000 },
    config,
  );

  try {
    let raw = response.content.trim();
    const fenceMatch = raw.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
    if (fenceMatch) {
      raw = fenceMatch[1].trim();
    }
    return JSON.parse(raw) as LlmAnalysisJson;
  } catch {
    return {
      summary: response.content.slice(0, 500),
      contentAnalysis: response.content,
      keyDetails: [],
      aiContext: response.content.slice(0, 200),
    };
  }
}

async function analyzeWebPage(
  url: string,
  config: Config,
): Promise<AnalysisResult> {
  let html = "";
  let fetchError: string | undefined;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      fetchError = `HTTP ${response.status} ${response.statusText}`;
    } else {
      html = await response.text();
    }
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Unknown fetch error";
  }

  if (fetchError || !html) {
    return {
      summary: `Failed to fetch web page: ${url}`,
      contentAnalysis: fetchError ?? "No content retrieved",
      keyDetails: [`URL: ${url}`, `Error: ${fetchError ?? "empty response"}`],
      aiContext: `Web page at ${url} could not be retrieved.`,
      metadata: { url, type: "web", error: fetchError },
    };
  }

  // Extract metadata with cheerio
  const $ = cheerio.load(html);
  const title =
    $("title").text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";
  const description =
    $('meta[name="description"]').attr("content") ||
    $('meta[property="og:description"]').attr("content") ||
    "";
  const author = $('meta[name="author"]').attr("content") || "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";

  // Extract article text with Readability
  let articleText = "";
  let readabilityFailed = false;

  try {
    const { document } = parseHTML(html);
    const reader = new Readability(document as unknown as Document);
    const article = reader.parse();
    if (article?.textContent) {
      articleText = article.textContent.trim();
    }
  } catch {
    readabilityFailed = true;
  }

  // Fallback: extract text with cheerio
  if (!articleText) {
    $("script, style, noscript, nav, footer, header, aside").remove();
    articleText = $("body").text().replace(/\s+/g, " ").trim();
  }

  const contentForLlm = articleText || description || title;

  if (!contentForLlm) {
    return {
      summary: title || `Web page: ${url}`,
      contentAnalysis: "No readable content could be extracted.",
      keyDetails: [`URL: ${url}`, ...(title ? [`Title: ${title}`] : [])],
      aiContext: `Web page at ${url}${title ? ` titled "${title}"` : ""} had no extractable text content.`,
      metadata: { url, title, description, author, ogImage, type: "web" },
    };
  }

  const parsed = await callLlmAnalysis(
    contentForLlm,
    `web page titled "${title || url}"`,
    config,
  );

  return {
    summary: parsed.summary ?? title ?? `Web page: ${url}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails)
      ? parsed.keyDetails
      : [],
    aiContext: parsed.aiContext ?? "",
    metadata: {
      url,
      title,
      description,
      author,
      ogImage,
      type: "web",
      readabilityFailed,
    },
  };
}

async function analyzeYouTube(
  url: string,
  config: Config,
): Promise<AnalysisResult> {
  const videoId = extractYouTubeVideoId(url);

  let html = "";
  let fetchError: string | undefined;

  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      fetchError = `HTTP ${response.status} ${response.statusText}`;
    } else {
      html = await response.text();
    }
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Unknown fetch error";
  }

  if (fetchError || !html) {
    return {
      summary: `Failed to fetch YouTube page: ${url}`,
      contentAnalysis: fetchError ?? "No content retrieved",
      keyDetails: [
        `URL: ${url}`,
        ...(videoId ? [`Video ID: ${videoId}`] : []),
        `Error: ${fetchError ?? "empty response"}`,
      ],
      aiContext: `YouTube video at ${url} could not be retrieved.`,
      metadata: { url, videoId, type: "youtube", error: fetchError },
    };
  }

  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text().replace(" - YouTube", "").trim() ||
    "";
  const channel =
    $('meta[itemprop="channelId"]').attr("content") ||
    $('span[itemprop="author"] link[itemprop="name"]').attr("content") ||
    "";
  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    "";
  const ogImage = $('meta[property="og:image"]').attr("content") || "";

  const contentForLlm = [
    title ? `Title: ${title}` : "",
    channel ? `Channel: ${channel}` : "",
    description ? `Description: ${description}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  if (!contentForLlm) {
    return {
      summary: title || `YouTube video: ${url}`,
      contentAnalysis:
        "Limited metadata could be extracted from the YouTube page.",
      keyDetails: [
        `URL: ${url}`,
        ...(videoId ? [`Video ID: ${videoId}`] : []),
      ],
      aiContext: `YouTube video at ${url}${title ? ` titled "${title}"` : ""}.`,
      metadata: { url, videoId, title, channel, type: "youtube" },
    };
  }

  const parsed = await callLlmAnalysis(
    contentForLlm,
    `YouTube video titled "${title || url}"`,
    config,
  );

  return {
    summary: parsed.summary ?? title ?? `YouTube video: ${url}`,
    contentAnalysis: parsed.contentAnalysis ?? "",
    keyDetails: Array.isArray(parsed.keyDetails)
      ? parsed.keyDetails
      : [],
    aiContext: parsed.aiContext ?? "",
    metadata: { url, videoId, title, channel, ogImage, type: "youtube" },
  };
}

export async function analyzeUrl(
  filePath: string,
  config: Config,
): Promise<AnalysisResult> {
  let url: string;

  // Determine URL source
  if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
    url = filePath;
  } else {
    const extracted = extractUrlFromFile(filePath);
    if (!extracted) {
      return {
        summary: `Could not extract URL from ${basename(filePath)}`,
        contentAnalysis: "File did not contain a recognizable URL.",
        keyDetails: [`File: ${filePath}`],
        aiContext: `URL file at ${filePath} could not be parsed.`,
        metadata: { filePath },
      };
    }
    url = extracted;
  }

  if (isYouTubeUrl(url)) {
    return analyzeYouTube(url, config);
  }

  return analyzeWebPage(url, config);
}
