# SuperMark

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

## Digest Format

Each digested file produces a companion `.md` file:

```markdown
# <filename>

## Summary
One-paragraph description of what this file is and does.

## File Info
- **Type**: detected file type
- **Size**: file size
- **Created**: timestamp
- **Digested**: digest timestamp

## Content Analysis
Type-specific analysis (function list for code, schema for data, etc.)

## Key Details
Notable aspects, dependencies, relationships to other files.

## AI Context
Concise description optimized for AI consumption.
```

## Usage

```bash
# Start watching a directory
supermark watch ./my-files

# Digest a single file
supermark digest ./report.pdf

# Digest a URL
supermark digest https://example.com/article
```

## Configuration

Create a `supermark.config.json` in your project root:

```json
{
  "watchDir": "./input",
  "outputDir": "./digests",
  "recursive": true,
  "include": ["*"],
  "exclude": ["*.tmp", "*.lock"],
  "ai": {
    "provider": "openai",
    "model": "gpt-4o"
  }
}
```

### Options

| Setting | Description | Default |
|---------|-------------|---------|
| `watchDir` | Directory to watch for new files | `./input` |
| `outputDir` | Where to save digests | Same as watchDir |
| `recursive` | Watch subdirectories | `true` |
| `include` | File patterns to include | `["*"]` |
| `exclude` | File patterns to exclude | `[]` |
| `ai.provider` | AI provider (openai, anthropic, etc.) | — |
| `ai.model` | Model for digestion | — |

## Tech Stack

- **Runtime**: Node.js / Bun
- **File watching**: chokidar
- **AI**: Configurable LLM API (OpenAI, Anthropic, local models)
- **Speech-to-text**: Whisper API
- **Video understanding**: Gemini API
- **Document parsing**: pdf-parse, mammoth (DOCX), pptx-parser
- **Media probing**: ffprobe (via fluent-ffmpeg)
- **CLI**: Commander.js

## License

MIT
