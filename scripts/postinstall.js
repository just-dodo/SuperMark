#!/usr/bin/env node

const message = `
\x1b[32m+--------------------------------------+\x1b[0m
\x1b[32m|\x1b[0m  \x1b[1mSuperMark installed!\x1b[0m               \x1b[32m|\x1b[0m
\x1b[32m+--------------------------------------+\x1b[0m

  \x1b[1mSetup:\x1b[0m

  1. Set your API key:
     \x1b[36mexport OPENAI_API_KEY="sk-..."\x1b[0m

  2. Start watching:
     \x1b[36msupermark watch\x1b[0m

  \x1b[2mOptional: export GEMINI_API_KEY="AI..." (for video understanding)\x1b[0m

  \x1b[2mGet keys:\x1b[0m
  \x1b[2m  OpenAI: https://platform.openai.com/api-keys\x1b[0m
  \x1b[2m  Gemini: https://aistudio.google.com/apikey\x1b[0m

  \x1b[2mDocs: https://github.com/just-dodo/SuperMark\x1b[0m
`;

console.log(message);
