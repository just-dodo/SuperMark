# SuperMark - PRD

## Overview

SuperMark is a file digestion system that automatically generates AI-friendly markdown documentation for every file placed into a watched directory. Like Dropbox triggers sync on file addition, SuperMark triggers "digestion" — analyzing the file and producing a structured markdown summary that helps AI systems understand the file's content, purpose, and structure.

## Problem

AI tools work best with structured, contextual information. Raw files (code, data, images, PDFs, etc.) often lack the metadata and summaries that help AI reason about them effectively. Manually writing descriptions for every file is tedious and unsustainable.

## Solution

A watched directory (the "SuperMark folder") that automatically:

1. **Detects** when a new file is added
2. **Analyzes** the file's content, type, and structure
3. **Generates** a companion `.md` file with an AI-friendly summary
4. **Stores** the markdown alongside or in a parallel output directory

## Core Concepts

| Concept | Description |
|---------|-------------|
| **Drop folder** | The watched directory where users place files or URL files |
| **Digestion** | The process of analyzing a file or URL and generating its markdown |
| **Digest** | The resulting `.md` file — a structured summary of the original |
| **Trigger** | File addition event that starts digestion |
| **URL file** | A `.url` or `.webloc` file containing a URL to fetch and digest |

## User Flow

```
User drops file into SuperMark folder
  → File system watcher detects new file
    → Digestion pipeline runs
      → AI analyzes file content
        → Markdown digest is generated
          → Digest is saved as <filename>.md
```

## Functional Requirements

### FR-1: Directory Watching

- Watch a configured directory for new file additions
- Support recursive watching (subdirectories)
- Detect file creation and move/copy events
- Ignore temporary files, partial writes, and the generated `.md` files themselves
- Handle batch additions (multiple files at once)

### FR-2: File Analysis

- Identify file type (code, document, image, data, binary, etc.)
- Extract content and metadata appropriate to the file type:
  - **Code files**: language, imports, exports, functions, classes, dependencies
  - **Documents** (PDF, DOCX, TXT, etc.): text content, headings, structure
  - **Presentations** (PPTX, PPT, KEY): slide count, slide titles, text content per slide, speaker notes, embedded media descriptions
  - **Word documents** (DOCX, DOC): text content, headings, tables, embedded images, styles and formatting summary
  - **Images** (PNG, JPG, GIF, SVG, WEBP, etc.): visual description (via vision model), dimensions, format, EXIF metadata
  - **Audio** (MP3, WAV, M4A, FLAC, OGG, etc.): transcription (via speech-to-text), duration, format, sample rate, channels
  - **Video** (MP4, MOV, AVI, MKV, WEBM, etc.): full video understanding via Gemini API (native video input — no frame sampling needed), transcription, scene descriptions, duration, resolution, frame rate
  - **URLs** (via `.url` or `.webloc` files, or CLI command): fetch web page content, extract main text (readability), capture metadata (title, description, OG tags). For YouTube URLs: extract video transcript, metadata, and optionally send to Gemini for video understanding
  - **Data files** (CSV, JSON, YAML): schema, sample records, statistics
  - **Binary/unknown**: file size, magic bytes, best-effort description

### FR-3: Markdown Generation

- Generate a structured markdown file for each digested file
- Standard digest format:

```markdown
# <filename>

## Summary
<One-paragraph description of what this file is and does>

## File Info
- **Type**: <detected file type>
- **Size**: <file size>
- **Created**: <timestamp>
- **Digested**: <digest timestamp>

## Content Analysis
<Type-specific analysis — e.g., function list for code, schema for data>

## Key Details
<Notable aspects, dependencies, relationships to other files>

## AI Context
<Concise description optimized for AI consumption — what an AI needs to know to work with this file>
```

### FR-4: Output Management

- Save digests in a configurable output location (same directory or parallel structure)
- Naming convention: `<original-filename>.md` (e.g., `app.py` → `app.py.md`)
- Update existing digests when source files are modified (re-digestion)
- Option to delete digests when source files are removed

### FR-5: Configuration

- Config file (e.g., `supermark.config.json` or `.supermarkrc`)
- Configurable settings:
  - Watch directory path
  - Output directory path
  - File type filters (include/exclude patterns)
  - AI provider and model for digestion
  - Digest template customization
  - Watch depth (recursive or flat)

## Non-Functional Requirements

### NFR-1: Performance

- Digestion should begin within 2 seconds of file detection
- Queue system for batch additions — process files sequentially or with concurrency limit
- Debounce rapid file events (e.g., file copy completing)

### NFR-2: Reliability

- Graceful handling of unsupported file types (generate minimal digest, don't crash)
- Resume capability — if the process restarts, detect undigested files and process them
- Idempotent digestion — re-running on the same file produces consistent results

### NFR-3: Extensibility

- Plugin/adapter system for adding new file type analyzers
- Swappable AI backends (OpenAI, Anthropic, local models, etc.)
- Custom digest templates

## Tech Stack (Proposed)

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Node.js / Bun | Fast startup, good FS watching support |
| File watching | `chokidar` or native `fs.watch` | Proven cross-platform file watching |
| AI integration | LLM API (configurable) | Core digestion engine (text + vision models) |
| Speech-to-text | Whisper API / local Whisper | Audio transcription for audio files |
| Video understanding | Gemini API | Native video input — scene description, transcription, visual analysis without frame sampling |
| Document parsing | `pdf-parse`, `mammoth` (DOCX), `pptx-parser` | Extract text from office/document formats |
| Media probing | `ffprobe` (via `fluent-ffmpeg`) | Extract duration, resolution, codec info from audio/video |
| Vision | LLM Vision API | Describe images |
| Config | JSON or YAML config file | Simple, well-understood |
| CLI | Commander.js or similar | User interface for setup and control |

## MVP Scope

The minimum viable product includes:

1. Watch a single directory for new files
2. Digest supported file types:
   - Text-based files (code, plain text, JSON, CSV, markdown)
   - Documents (PDF, DOCX, DOC)
   - Presentations (PPTX, PPT)
   - Images (PNG, JPG, GIF, SVG, WEBP)
   - Audio (MP3, WAV, M4A) — with transcription
   - Video (MP4, MOV) — with audio transcription and key frame descriptions
3. Generate markdown digests with the standard format
4. URL digestion (web pages, YouTube) via `.url` files or `supermark digest <url>`
5. CLI to start/stop watching and configure the directory
6. Basic config file support

## Future Considerations

- Web UI dashboard showing digestion status and history
- Digest search and querying
- Relationship mapping between digested files
- Incremental digestion for large files
- Webhook/notification on digest completion
- Integration with AI coding tools (auto-load digests as context)
- Cloud sync of digests
