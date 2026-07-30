# Quick Language Polish ✨

[English](README.md) · [Deutsch](README.de.md) · [简体中文](README.zh-CN.md)

一个基于 Bun、TypeScript、Vite 和 Vue 构建、运行于 Cloudflare Workers 的应用，使用 Workers AI 对文本进行润色。试用[在线演示](https://quick-language-polish.karsten-zhou-773.workers.dev/)。

如需长期使用，建议部署属于您自己的实例，以使用 Cloudflare 提供的免费 Workers AI 配额。您可以点击上方按钮一键部署，也可以按照下方步骤手动设置。

[![部署到 Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/XiaoSong-CPE/quick-language-polish)

![Quick Language Polish screenshot](image.png)

## 功能特性

- AI 驱动的文本润色
- 多种 Cloudflare AI 模型可选
- 流式响应（SSE）
- 简洁的 HTTP Basic Auth 保护
- 一键部署至 Cloudflare Workers

## 环境要求

- [Bun](https://bun.sh)（推荐）或 Node.js 22+
- 一个已启用 [Workers AI](https://developers.cloudflare.com/workers-ai/) 的 Cloudflare 账户

## 安装与配置

### 1. 安装依赖

```bash
bun install
# 或: npm install
```

### 2. 配置凭证（可选，但推荐）

应用在未配置认证时也能正常工作——但任何知道链接的人都能使用您的实例。如需保护，请配置凭证。

复制示例环境文件并编辑：

```bash
cp .env.example .env
```

在 `.env` 中将 `AUTH_USERNAME` 和 `AUTH_PASSWORD` 设置为您自己的用户名和密码。

对于生产环境，将相同的密钥上传到 Cloudflare：

```bash
bunx wrangler secret put AUTH_USERNAME
bunx wrangler secret put AUTH_PASSWORD
```

> **注意：** 不要将凭证作为普通 `vars` 写入 `wrangler.jsonc`。请使用 Cloudflare Secrets，它们会加密存储，并且不会在 Cloudflare 控制台中直接显示。
>
> **⚠️ 如果跳过此步骤**，您的实例将公开可访问。任何知道链接的人都能使用并消耗您免费的 Workers AI 配额。个人使用较为方便，但不建议在共享或生产环境中这样做。

### 3. 本地运行

```bash
bun run dev
```

### 4. 构建

```bash
bun run build
```

### 5. 部署

```bash
bun run deploy
```

## API

### `POST /api/polish`

支持可选的 **HTTP Basic Auth**。如果配置了 `AUTH_USERNAME` 和 `AUTH_PASSWORD` Secrets，客户端会使用用户在界面中输入的用户名和密码进行认证。如果未配置，则跳过认证，端点直接开放。

**请求体：**

```json
{
  "text": "要润色的文本",
  "model": "@cf/qwen/qwen3-30b-a3b-fp8"
}
```

`model` 字段为可选，默认为 `@cf/meta/llama-4-scout-17b-16e-instruct`。

**响应：** 返回 SSE（`text/event-stream`）响应，采用 OpenAI 兼容的流式格式，包含 `data: {"choices":[{"delta":{"content":"token"}}]}` 数据块，最后以 `data: [DONE]` 结束。

### 可用模型

| 模型 ID                                   | 名称                         |
| ----------------------------------------- | ---------------------------- |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | Llama 4 Scout 17B _（默认）_ |
| `@cf/qwen/qwen3-30b-a3b-fp8`              | Qwen 3 30B                   |
| `@cf/google/gemma-4-26b-a4b-it`           | Gemma 4 26B                  |
| `@cf/openai/gpt-oss-120b`                 | GPT-OSS 120B                 |
| `@cf/moonshotai/kimi-k2.6`                | Kimi K2.6 _（需付费套餐）_   |

### 错误响应

| 状态码 | 含义                             |
| ------ | -------------------------------- |
| `400`  | 无效请求（输入缺失或格式错误）   |
| `401`  | 凭证错误 — 请检查用户名和密码    |
| `422`  | 模型拒绝处理该请求               |
| `500`  | 服务器配置错误（缺少绑定或密钥） |
| `502`  | Workers AI 运行时故障            |
