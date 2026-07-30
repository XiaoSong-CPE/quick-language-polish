# quick-language-polish

A minimal Bun + TypeScript + Vite + Vue app on Cloudflare Workers that refines text with Workers AI.

## Requirements

- Bun (recommended package manager/runtime)
- Node.js 22+ (fallback)
- Cloudflare account with Workers AI enabled

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

   (or `npm install`)

2. Configure credentials:

   ```bash
   cp .env.example .env
   ```

   Update `AUTH_USERNAME` and `AUTH_PASSWORD` with your own values.

   For production, upload the same secrets to Cloudflare:

   ```bash
   bunx wrangler secret put AUTH_USERNAME
   bunx wrangler secret put AUTH_PASSWORD
   ```

   > **Note:** Avoid storing these as plain `vars` in `wrangler.jsonc` — secrets are encrypted at rest and not visible in the Cloudflare dashboard.

3. Run locally:

   ```bash
   bun run dev
   ```

4. Build:

   ```bash
   bun run build
   ```

5. Deploy:

   ```bash
   bun run deploy
   ```

## API behavior

- `POST /api/polish` requires HTTP Basic auth.
- Request body: `{ "text": "...", "model?": "@cf/meta/llama-3.2-3b-instruct" }`
- Response: SSE stream (`text/event-stream`) with `data: {"response":"token"}` chunks and a final `data: [DONE]`.
- Available models (selectable in the UI):
  - `@cf/meta/llama-3.2-3b-instruct` — Llama 3.2 3B
  - `@cf/meta/llama-3.1-8b-instruct-fast` — Llama 3.1 8B
  - `@cf/meta/llama-4-scout-17b-16e-instruct` — Llama 4 Scout 17B
  - `@cf/qwen/qwen3-30b-a3b-fp8` — Qwen 3 30B
  - `@cf/google/gemma-4-26b-a4b-it` — Gemma 4 26B
- Common errors are surfaced in UI:
  - bad credentials (`401`)
  - invalid input (`400`)
  - model refusal (detected client-side)
  - AI/runtime failures (`502` / `500`)
