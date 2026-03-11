# SuperMark

[![npm version](https://img.shields.io/npm/v/@justdodo/supermark)](https://www.npmjs.com/package/@justdodo/supermark)

A file digestion system that automatically generates AI-friendly markdown documentation for every file placed into a watched directory.

Drop a file in → get a structured markdown summary out.

## How It Works

```
User drops file into SuperMark folder
  → File system watcher detects new file
    → Digestion pipeline analyzes content
      → AI generates structured markdown
        → Digest saved as <filename>.md
```

## Supported File Types

| Category | Formats | Analysis |
|----------|---------|----------|
| **Code** | .py, .js, .ts, .go, etc. | Language, imports, exports, functions, classes |
| **Documents** | PDF, DOCX, DOC | Text content, headings, tables, structure |
| **Presentations** | PPTX, PPT, KEY | Slides, titles, speaker notes |
| **Images** | PNG, JPG, GIF, SVG, WEBP | Visual description (via vision model), dimensions, EXIF |
| **Audio** | MP3, WAV, M4A, FLAC, OGG | Transcription, duration, format metadata |
| **Video** | MP4, MOV, AVI, MKV, WEBM | Video understanding (Gemini API), transcription, scenes |
| **Data** | CSV, JSON, YAML | Schema, sample records, statistics |
| **URLs** | .url, .webloc files | Web page content, metadata, YouTube transcripts |

## Install

```bash
npm install -g @justdodo/supermark
```

### Prerequisites

- **Node.js** >= 18
- **ffmpeg/ffprobe** — for audio/video metadata (`brew install ffmpeg` on macOS)
- **API keys** (set as environment variables):
  - `OPENAI_API_KEY` — required for LLM analysis and Whisper transcription
  - `GEMINI_API_KEY` — required for video understanding

## Quick Start

```bash
# 1. Set your API key
export OPENAI_API_KEY="sk-..."

# 2. Start watching (auto-creates config on first run, runs as daemon)
supermark watch
# => SuperMark daemon started (PID: 12345)
# => Stop with: supermark stop

# 3. Drop files in — digests appear alongside them as <filename>.md
cp my-report.pdf .
# => ./my-report.pdf.md created automatically

# Or run in foreground (for debugging)
supermark watch --foreground

# Or digest a single file directly
supermark digest ./some-file.py

# Or digest a URL
supermark digest https://example.com/article
```

### CLI Commands

| Command | Description |
|---------|-------------|
| `supermark watch` | Start watching as a background daemon (auto-inits if needed) |
| `supermark watch -f` | Run watcher in foreground |
| `supermark stop` | Stop the background daemon |
| `supermark digest <file\|url>` | Digest a single file or URL |
| `supermark init` | Manually create default config |
| `supermark status` | Show current configuration and status |

## Digest Format

Each digested file produces a companion `.md` file:

```markdown
# <filename>

## Summary
One-paragraph description of what this file is and does.

## File Info
- **Type**: detected file type
- **Size**: file size
- **Hash**: SHA-256 hash
- **Modified**: last modified date
- **Digested**: digest timestamp

## Content Analysis
Type-specific analysis (function list for code, schema for data, etc.)

## Key Details
Notable aspects, dependencies, relationships to other files.

## AI Context
Concise description optimized for AI consumption.
```

## Configuration

A `supermark.config.json` is auto-created on first `supermark watch`. You can also create it manually:

```json
{
  "watchDir": ".",
  "outputDir": ".",
  "recursive": true,
  "concurrency": 3,
  "debounceMs": 1000,
  "ignore": ["*.tmp", ".DS_Store", "**/*.md"],
  "cleanupDigests": true,
  "ai": {
    "provider": "openai",
    "model": "gpt-4o",
    "whisperModel": "whisper-1"
  }
}
```

### Options

| Setting | Description | Default |
|---------|-------------|---------|
| `watchDir` | Directory to watch for new files | `.` |
| `outputDir` | Where to save digests | `.` |
| `recursive` | Watch subdirectories | `true` |
| `concurrency` | Max parallel digestions | `3` |
| `debounceMs` | Wait time before processing (ms) | `1000` |
| `ignore` | File patterns to ignore | `["*.tmp", ".DS_Store", "**/*.md"]` |
| `cleanupDigests` | Delete digest when source is removed | `true` |
| `ai.provider` | AI provider | `"openai"` |
| `ai.model` | LLM model for analysis | `"gpt-4o"` |
| `ai.whisperModel` | Whisper model for transcription | `"whisper-1"` |

## Tech Stack

- **Runtime**: Node.js
- **File watching**: chokidar
- **AI**: OpenAI (LLM + Whisper), Gemini (video)
- **Document parsing**: pdf-parse, mammoth (DOCX)
- **Web extraction**: Readability, cheerio
- **Media probing**: ffprobe (via fluent-ffmpeg)
- **Image metadata**: sharp
- **CLI**: Commander.js

## License

MIT
