# Quick Language Polish ✨

[English](README.md) · [Deutsch](README.de.md) · [简体中文](README.zh-CN.md)

A Cloudflare Workers application built with Bun, TypeScript, Vite, and Vue that refines text using Workers AI. Try the [live demo](https://quick-language-polish.karsten-zhou-773.workers.dev/) using username `your-username` and password `your-password`.

For everyday use, deploy your own instance to Cloudflare to use your own free Workers AI quota. You can one-click deploy with the button below, or follow the manual setup.

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XiaoSong-CPE/quick-language-polish)

![Quick Language Polish screenshot](image.png)

## Features

- AI-powered text polishing
- Multiple Cloudflare AI models to choose from
- Streaming responses (SSE)
- Simple HTTP Basic Auth protection
- One-click deployment to Cloudflare Workers

## Requirements

- [Bun](https://bun.sh) (recommended) or Node.js 22+
- A Cloudflare account with [Workers AI](https://developers.cloudflare.com/workers-ai/) enabled

## Setup

### 1. Install dependencies

```bash
bun install
# or: npm install
```

### 2. Configure credentials (optional but recommended)

The app works without authentication — anyone with the URL can use your instance. If you'd like to protect it, configure credentials.

Copy the example environment file and edit it:

```bash
cp .env.example .env
```

Set `AUTH_USERNAME` and `AUTH_PASSWORD` in `.env` to your own credentials.

For production, upload the same secrets to Cloudflare:

```bash
bunx wrangler secret put AUTH_USERNAME
bunx wrangler secret put AUTH_PASSWORD
```

> **Note:** Don't store credentials as plain `vars` in `wrangler.jsonc`. Use Cloudflare Secrets instead — they're encrypted at rest and aren't exposed in the Cloudflare dashboard.
>
> **⚠️ If you skip this step**, your instance will be publicly accessible. Anyone with the URL can use it and consume your free Workers AI quota. This is convenient for personal use but not recommended for shared or production environments.

### 3. Run locally

```bash
bun run dev
```

### 4. Build

```bash
bun run build
```

### 5. Deploy

```bash
bun run deploy
```

## API

### `POST /api/polish`

Supports optional **HTTP Basic Auth**. If `AUTH_USERNAME` and `AUTH_PASSWORD` Secrets are configured, the client authenticates using the username and password entered in the UI. If not configured, authentication is skipped and the endpoint is open.

**Request body:**

```json
{
  "text": "Your text to refine",
  "model": "@cf/qwen/qwen3-30b-a3b-fp8"
}
```

The `model` field is optional and defaults to `@cf/meta/llama-4-scout-17b-16e-instruct`.

**Response:** Returns an SSE (`text/event-stream`) response in an OpenAI-compatible streaming format, with `data: {"choices":[{"delta":{"content":"token"}}]}` chunks followed by `data: [DONE]`.

### Available models

| Model ID                                  | Label                            |
| ----------------------------------------- | -------------------------------- |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | Llama 4 Scout 17B _(default)_    |
| `@cf/qwen/qwen3-30b-a3b-fp8`              | Qwen 3 30B                       |
| `@cf/google/gemma-4-26b-a4b-it`           | Gemma 4 26B                      |
| `@cf/openai/gpt-oss-120b`                 | GPT-OSS 120B                     |
| `@cf/moonshotai/kimi-k2.6`                | Kimi K2.6 _(paid plan required)_ |

### Error responses

| Status | Meaning                                               |
| ------ | ----------------------------------------------------- |
| `400`  | Invalid request (missing or malformed input)          |
| `401`  | Bad credentials — check your username and password    |
| `422`  | Model refused the request                             |
| `500`  | Server misconfiguration (missing bindings or secrets) |
| `502`  | Workers AI runtime failure                            |
