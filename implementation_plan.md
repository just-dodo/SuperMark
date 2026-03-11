# SuperMark - Implementation Plan

## Project Setup

### Phase 0: Scaffolding

- Initialize Node.js/Bun project with TypeScript
- Set up project structure:

```
supermark/
├── src/
│   ├── cli/              # CLI entry point and commands
│   │   └── index.ts
│   ├── watcher/          # File system watching
│   │   └── index.ts
│   ├── queue/            # Digestion job queue
│   │   └── index.ts
│   ├── analyzers/        # File type analyzers (one per type)
│   │   ├── index.ts      # Analyzer registry and router
│   │   ├── text.ts       # Code, plain text, markdown
│   │   ├── document.ts   # PDF, DOCX, DOC
│   │   ├── presentation.ts # PPTX, PPT
│   │   ├── image.ts      # PNG, JPG, GIF, SVG, WEBP
│   │   ├── audio.ts      # MP3, WAV, M4A, FLAC, OGG
│   │   ├── video.ts      # MP4, MOV, AVI, MKV, WEBM
│   │   ├── url.ts        # Web pages, YouTube URLs
│   │   ├── data.ts       # CSV, JSON, YAML
│   │   └── binary.ts     # Fallback for unknown types
│   ├── ai/               # AI provider integrations
│   │   ├── index.ts      # Provider router
│   │   ├── llm.ts        # Text/vision LLM (OpenAI, Anthropic, etc.)
│   │   ├── whisper.ts    # Speech-to-text
│   │   └── gemini.ts     # Gemini API for video understanding
│   ├── generator/        # Markdown digest generator
│   │   └── index.ts
│   ├── config/           # Configuration loading
│   │   └── index.ts
│   └── utils/            # Shared utilities
│       ├── file.ts       # File type detection, metadata extraction
│       └── media.ts      # ffprobe wrapper
├── supermark.config.json # Default config
├── package.json
└── tsconfig.json
```

- Install core dependencies:
  - `chokidar` — file watching
  - `commander` — CLI
  - `p-queue` — concurrency-limited job queue
- Install analyzer dependencies:
  - `pdf-parse` — PDF text extraction
  - `mammoth` — DOCX parsing
  - `pptx-parser` or `officegen` — PPTX parsing
  - `fluent-ffmpeg` — ffprobe wrapper for media metadata
  - `exif-reader` or `sharp` — image metadata/EXIF
- Install AI dependencies:
  - `openai` — OpenAI/Whisper API client
  - `@google/generative-ai` — Gemini API client
  - `@anthropic-ai/sdk` — Anthropic API client (optional)

---

## Implementation Phases

### Phase 1: Core Pipeline (Watcher → Queue → Text Digestion)

**Goal:** Drop a text file in, get a markdown digest out.

#### 1.1 Configuration (`src/config/`)

- Load config from `supermark.config.json` or `.supermarkrc`
- Merge defaults with user overrides
- Config schema:

```json
{
  "watchDir": "./inbox",
  "outputDir": "./digests",
  "recursive": true,
  "concurrency": 3,
  "debounceMs": 1000,
  "ignore": ["*.tmp", "*.md", ".DS_Store"],
  "ai": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "${OPENAI_API_KEY}",
    "geminiApiKey": "${GEMINI_API_KEY}",
    "whisperModel": "whisper-1"
  }
}
```

#### 1.2 File Watcher (`src/watcher/`)

- Use `chokidar` to watch the configured directory
- Listen for `add` events (new files)
- Debounce events (wait for file write to complete — check stable file size)
- Filter out:
  - Files matching ignore patterns
  - Generated `.md` digest files (detect by output directory or `.md` suffix convention)
  - Temporary/partial files
- Emit file paths to the queue

#### 1.3 Job Queue (`src/queue/`)

- Use `p-queue` with configurable concurrency
- Each job: `{ filePath, detectedType, status, retries }`
- On job start: detect file type → route to appropriate analyzer
- On job complete: pass analysis result to markdown generator
- On job failure: log error, retry up to 2 times, then mark as failed with minimal digest

#### 1.4 Text Analyzer (`src/analyzers/text.ts`)

- Handle: `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.txt`, `.md`, `.html`, `.css`, etc.
- Read file content as UTF-8
- Detect language from extension
- Send content to LLM with prompt:
  - "Analyze this file. Provide: summary, purpose, key components (functions/classes/exports), dependencies, and a concise AI context description."
- Return structured analysis result

#### 1.5 Markdown Generator (`src/generator/`)

- Accept analysis result + file metadata
- Render using the standard digest template
- Write to output directory as `<filename>.md`
- Include file info (type, size, timestamps)

#### 1.6 CLI (`src/cli/`)

- `supermark watch` — start watching (foreground process)
- `supermark digest <file>` — digest a single file manually
- `supermark init` — create default config file
- `supermark status` — show watch status, queue stats

**Milestone:** `supermark watch` detects a new `.py` file and creates a `.py.md` digest.

---

### Phase 2: Document Analyzers (PDF, DOCX, PPTX)

#### 2.1 PDF Analyzer (`src/analyzers/document.ts`)

- Use `pdf-parse` to extract text content
- Send extracted text to LLM for summarization
- Include: page count, text content, detected headings/structure

#### 2.2 Word Document Analyzer (`src/analyzers/document.ts`)

- Use `mammoth` to extract text and structure from DOCX
- For DOC files: use `mammoth` or shell out to `libreoffice --convert-to docx` as fallback
- Send to LLM: text content, headings, tables

#### 2.3 Presentation Analyzer (`src/analyzers/presentation.ts`)

- Parse PPTX using `pptx-parser` or unzip + XML parsing
- Extract: slide count, slide titles, text per slide, speaker notes
- Send to LLM for overall summary and per-slide descriptions

**Milestone:** Drop a PDF, DOCX, or PPTX → get a structured digest.

---

### Phase 3: Image Analyzer

#### 3.1 Image Analyzer (`src/analyzers/image.ts`)

- Extract metadata: dimensions, format, file size, EXIF data (using `sharp` or `exif-reader`)
- Send image to vision-capable LLM (e.g., GPT-4o, Claude) for visual description
- Prompt: "Describe this image in detail. What does it show? What would an AI need to know about this image to use it effectively?"
- Return: visual description, metadata, AI context

**Milestone:** Drop a PNG → get a digest with visual description and metadata.

---

### Phase 4: Audio Analyzer

#### 4.1 Audio Analyzer (`src/analyzers/audio.ts`)

- Use `ffprobe` to extract: duration, format, sample rate, channels, bitrate
- Send audio file to Whisper API for transcription
- Send transcription to LLM for summary
- Return: full transcription, summary, audio metadata, AI context

#### 4.2 Large File Handling

- For audio files > 25MB (Whisper API limit): split into chunks using `ffmpeg`
- Concatenate transcriptions
- Summarize the full transcription

**Milestone:** Drop an MP3 → get a digest with transcription and summary.

---

### Phase 5: Video Analyzer (Gemini API)

#### 5.1 Video Analyzer (`src/analyzers/video.ts`)

- Use `ffprobe` to extract: duration, resolution, frame rate, codec, file size
- Upload video to Gemini API using the File API:
  1. Upload video file via `files.upload()`
  2. Poll until processing is complete (`state === "ACTIVE"`)
  3. Send to Gemini with prompt requesting: scene-by-scene description, audio transcription, key moments, visual summary
- Parse Gemini response into structured analysis
- Return: scene descriptions, transcription, video metadata, AI context

#### 5.2 Fallback Strategy

- If video > Gemini file size limit: extract audio → Whisper transcription + sample key frames → vision LLM
- If Gemini API unavailable: fall back to audio-only transcription + frame sampling

**Milestone:** Drop an MP4 → get a rich digest with scene descriptions and transcription from Gemini.

---

### Phase 6: URL Analyzer

#### 6.1 URL Detection (`src/analyzers/url.ts`)

- Detect URL input from:
  - `.url` files (Windows shortcut format — parse `URL=` line)
  - `.webloc` files (macOS — parse plist XML)
  - Direct CLI input: `supermark digest https://example.com`
- Route by URL type:
  - **YouTube URLs** → YouTube-specific pipeline
  - **All other URLs** → Web page pipeline

#### 6.2 Web Page Digestion

- Fetch page HTML using `fetch` or `puppeteer` (for JS-rendered pages)
- Extract readable content using `@mozilla/readability` or `cheerio`
- Extract metadata: title, description, OG tags, author, publish date
- Send extracted text to LLM for summary
- Return: page title, readable text, metadata, summary, AI context

#### 6.3 YouTube URL Digestion

- Extract video ID from URL
- Fetch transcript via `youtube-transcript` or YouTube Data API
- Fetch video metadata: title, channel, duration, description, thumbnail
- Optionally: download video and send to Gemini API for visual understanding
- Send transcript + metadata to LLM for summary
- Return: title, transcript, scene descriptions (if Gemini used), metadata, AI context

#### 6.4 CLI Integration

- `supermark digest <url>` — digest a URL directly without a file
- Generates digest named by page title or URL slug (e.g., `example-com-article-title.md`)

**Milestone:** Drop a `.url` file or run `supermark digest https://...` → get a markdown digest of the web page or YouTube video.

---

### Phase 7: Data & Binary Analyzers

#### 7.1 Data Analyzer (`src/analyzers/data.ts`)

- CSV: parse headers, row count, sample rows, column types/statistics
- JSON: detect schema (or use sample), describe structure, nested depth
- YAML: similar to JSON
- Send schema + sample to LLM for summary

#### 7.2 Binary Analyzer (`src/analyzers/binary.ts`)

- Read magic bytes to identify file type
- Extract file size, creation date
- Generate minimal digest: "Binary file of type X, Y bytes"
- No LLM call — just metadata

**Milestone:** All file types have an analyzer. No file crashes the system.

---

### Phase 8: Re-digestion & Cleanup

#### 8.1 File Change Detection

- Watch for `change` events (file modified) in addition to `add`
- Compare file hash (MD5/SHA256) with stored hash in digest metadata
- Re-digest only if content actually changed

#### 8.2 Digest Cleanup

- Watch for `unlink` events (file deleted)
- Optionally delete corresponding digest (configurable)
- Log deletions

#### 8.3 Startup Scan

- On `supermark watch` start, scan watch directory for files without digests
- Queue undigested files for processing
- Skip files that already have up-to-date digests

**Milestone:** Modify a file → digest updates. Delete a file → digest cleaned up. Restart → undigested files caught.

---

## File Type → Analyzer Routing

| Extension(s) | Analyzer | AI Service |
|--------------|----------|------------|
| `.ts`, `.js`, `.py`, `.go`, `.rs`, `.java`, `.c`, `.cpp`, `.rb`, `.php`, `.swift`, `.kt` | `text` | LLM |
| `.txt`, `.md`, `.html`, `.css`, `.xml` | `text` | LLM |
| `.pdf` | `document` | pdf-parse → LLM |
| `.docx`, `.doc` | `document` | mammoth → LLM |
| `.pptx`, `.ppt` | `presentation` | pptx-parser → LLM |
| `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.bmp`, `.tiff` | `image` | Vision LLM |
| `.mp3`, `.wav`, `.m4a`, `.flac`, `.ogg`, `.aac` | `audio` | Whisper → LLM |
| `.mp4`, `.mov`, `.avi`, `.mkv`, `.webm` | `video` | Gemini API |
| `.url`, `.webloc` | `url` | Fetch → Readability → LLM |
| YouTube URLs | `url` (YouTube pipeline) | Transcript + Gemini API |
| Other URLs (via CLI) | `url` (web pipeline) | Fetch → Readability → LLM |
| `.csv`, `.json`, `.yaml`, `.yml` | `data` | Parser → LLM |
| Everything else | `binary` | Metadata only |

---

## Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| LLM API rate limit | Exponential backoff, retry up to 3 times |
| File read permission error | Log warning, skip file, generate error digest |
| Unsupported file type | Route to binary analyzer, generate minimal digest |
| Large file (>100MB) | Warn in logs, attempt with chunking strategy per type |
| Gemini upload fails | Fall back to audio transcription + frame sampling |
| Whisper transcription fails | Generate digest without transcription, note in digest |
| Partial file write detected | Debounce — wait for stable file size before processing |
| Corrupt file | Log error, generate error digest noting corruption |

---

## Suggested Development Order

```
Phase 0: Scaffolding                          [~1 day]
Phase 1: Core Pipeline (text files)           [~2 days]
Phase 2: Document Analyzers (PDF/DOCX/PPTX)  [~2 days]
Phase 3: Image Analyzer                       [~1 day]
Phase 4: Audio Analyzer (Whisper)             [~1 day]
Phase 5: Video Analyzer (Gemini)              [~2 days]
Phase 6: URL Analyzer (web pages, YouTube)    [~2 days]
Phase 7: Data & Binary Analyzers              [~1 day]
Phase 8: Re-digestion & Cleanup               [~1 day]
```

Each phase is independently testable and builds on the previous one. The core pipeline (Phase 1) is the foundation — once it works, each analyzer phase plugs in cleanly.
