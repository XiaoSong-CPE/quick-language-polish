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
   cp .env.example .dev.vars
   ```

   Update `AUTH_USERNAME` and `AUTH_PASSWORD` with your own values.

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
- Request body: `{ "text": "..." }`
- Response body: `{ "polishedText": "..." }`
- Common errors are surfaced in UI:
  - bad credentials (`401`)
  - invalid input (`400`)
  - model refusal (`422`, code `AI_REFUSAL`)
  - AI/runtime failures (`502` / `500`)
