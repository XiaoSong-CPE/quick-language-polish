import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { StatusCodes } from "http-status-codes";
import { z } from "zod";

type AiBinding = {
  run: (model: string, options: Record<string, unknown>) => Promise<unknown>;
};

type AssetsBinding = {
  fetch: (request: Request) => Promise<Response>;
};

type Bindings = {
  AI: AiBinding;
  ASSETS: AssetsBinding;
  AUTH_USERNAME: string;
  AUTH_PASSWORD: string;
};

const AVAILABLE_MODELS = [
  "@cf/meta/llama-4-scout-17b-16e-instruct",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/google/gemma-4-26b-a4b-it",
  "@cf/openai/gpt-oss-120b",
  "@cf/moonshotai/kimi-k2.6",
] as const;

const requestSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Please enter some text.")
    .max(4 * 1024, "Text is too long."),
  model: z.string().optional(),
});

const app = new Hono<{ Bindings: Bindings }>();

const REFUSAL_PATTERN =
  /\b(i(?:'| a)?m sorry|i can(?:not|'t|’t)|unable to|won't|will not|cannot assist|can't assist)\b/i;

const createPrompt = (text: string) =>
  `Refine this text for natural fluency, correcting any awkward or non-native phrasing. Return ONLY the polished text, nothing else. Do not use quotes.\n\n${text}`;

const extractPolishedText = (result: unknown): string | null => {
  if (typeof result === "string") {
    return result.trim();
  }

  if (result && typeof result === "object") {
    const data = result as { response?: unknown; result?: unknown };

    if (typeof data.response === "string") {
      return data.response.trim();
    }

    if (typeof data.result === "string") {
      return data.result.trim();
    }
  }

  return null;
};

app.post(
  "/api/polish",
  // Only require auth when credentials are configured.
  // When AUTH_USERNAME or AUTH_PASSWORD is missing, the endpoint is open.
  async (c, next) => {
    const user = c.env.AUTH_USERNAME?.trim();
    const pass = c.env.AUTH_PASSWORD?.trim();
    if (user && pass) {
      const auth = basicAuth({
        verifyUser: (username, password) =>
          username === user && password === pass,
      });
      await auth(c, next);
    } else {
      await next();
    }
  },
  zValidator("json", requestSchema, (validationResult, c) => {
    if (!validationResult.success) {
      return c.json(
        {
          error: "Invalid request.",
          details: validationResult.error.issues,
        },
        StatusCodes.BAD_REQUEST,
      );
    }
  }),
  async (c) => {
    if (!c.env.AI || typeof c.env.AI.run !== "function") {
      return c.json(
        { error: "AI binding is missing. Configure `AI` in wrangler.jsonc." },
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const { text, model: clientModel } = c.req.valid("json");
    const model =
      clientModel &&
      (AVAILABLE_MODELS as readonly string[]).includes(clientModel)
        ? clientModel
        : "@cf/meta/llama-4-scout-17b-16e-instruct";

    try {
      const result = await c.env.AI.run(model, {
        messages: [{ role: "user", content: createPrompt(text) }],
        stream: true,
        max_tokens: 4 * 1024,
        max_completion_tokens: 4 * 1024,
      });

      // Pass the CF AI stream through directly — the client will parse the raw CF SSE format
      if (result instanceof ReadableStream) {
        return new Response(result, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      // Fallback: non-streaming response (some models may not support streaming)
      const polishedText = extractPolishedText(result);

      if (!polishedText) {
        return c.json(
          { error: "Workers AI returned an empty response." },
          StatusCodes.BAD_GATEWAY,
        );
      }

      if (REFUSAL_PATTERN.test(polishedText)) {
        return c.json(
          {
            error: "The AI model refused to process this input.",
            code: "AI_REFUSAL",
            polishedText,
          },
          StatusCodes.UNPROCESSABLE_ENTITY,
        );
      }

      return c.json({ polishedText }, StatusCodes.OK);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Workers AI error.";

      return c.json(
        { error: "Workers AI request failed.", details: message },
        StatusCodes.BAD_GATEWAY,
      );
    }
  },
);

app.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
