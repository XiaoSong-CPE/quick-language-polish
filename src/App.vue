<script setup lang="ts">
import { useLocalStorage, useClipboard } from "@vueuse/core";
import { ref } from "vue";

const MODELS = [
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen 3 30B" },
  { id: "@cf/google/gemma-4-26b-a4b-it", label: "Gemma 4 26B" },
  { id: "@cf/openai/gpt-oss-120b", label: "GPT-OSS 120B" },
] as const;

const username = useLocalStorage("qlp-username", "");
const password = useLocalStorage("qlp-password", "");
const selectedModel = useLocalStorage("qlp-model", MODELS[0].id);

const text = ref("");
const polishedText = ref("");
const errorMessage = ref("");
const loading = ref(false);

const { copy, copied } = useClipboard();

const polishText = async () => {
  polishedText.value = "";
  errorMessage.value = "";

  if (!text.value.trim()) {
    errorMessage.value = "Please enter text to polish.";
    return;
  }

  loading.value = true;

  try {
    const response = await fetch("/api/polish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa(`${username.value}:${password.value}`)}`,
      },
      body: JSON.stringify({
        text: text.value,
        model: selectedModel.value,
      }),
    });

    if (!response.ok) {
      let errorBody: {
        error?: string;
        details?: string;
        code?: string;
      } | null = null;
      try {
        errorBody = await response.json();
      } catch {
        /* ignore */
      }

      if (response.status === 401) {
        errorMessage.value = "Authentication failed. Check account/password.";
      } else if (errorBody?.code === "AI_REFUSAL") {
        errorMessage.value =
          errorBody.error ?? "The AI model refused the request.";
      } else {
        errorMessage.value =
          errorBody?.error ?? `Request failed with status ${response.status}.`;
      }
      if (errorBody?.details) {
        errorMessage.value = `${errorMessage.value} (${errorBody.details})`;
      }
      return;
    }

    // Parse CF AI SSE stream — Workers AI binding returns OpenAI-compatible
    // SSE format: data: {"choices":[{"delta":{"content":"token"}}]}
    // or data: [DONE]
    const reader = response.body?.getReader();
    if (!reader) {
      errorMessage.value = "No response body received.";
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (!data || data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          // OpenAI-compatible: choices[0].delta.content
          const token =
            parsed.choices?.[0]?.delta?.content ??
            // Fallback: legacy CF format { response: "token" }
            (typeof parsed.response === "string" ? parsed.response : null);
          if (typeof token === "string" && token) {
            polishedText.value += token;
          }
        } catch {
          // skip unparseable
        }
      }
    }

    // Trim leading/trailing whitespace from the final result
    polishedText.value = polishedText.value.trim();

    // Check for refusal
    if (
      /^(i(?:'| a)?m sorry|i can(?:not|'t)|unable to|cannot assist)/i.test(
        polishedText.value,
      )
    ) {
      errorMessage.value = "The AI model refused to process this input.";
      polishedText.value = "";
    }
  } catch {
    errorMessage.value = "Unexpected error while calling the API.";
  } finally {
    loading.value = false;
  }
};

const copyPolishedText = () => {
  copy(polishedText.value);
};
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
    <main class="max-w-3xl mx-auto px-4 py-10">
      <header class="mb-8 text-center">
        <h1 class="text-4xl font-bold text-slate-800 tracking-tight">
          ✨ Quick Language Polish
        </h1>
        <p class="mt-2 text-slate-500">
          Sign in, pick a model, and refine your text with Cloudflare Workers
          AI.
        </p>
      </header>

      <form
        @submit.prevent="polishText"
        class="space-y-5 bg-white rounded-2xl shadow-md border border-slate-200 p-6"
      >
        <!-- Auth row -->
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-slate-600">Account</span>
            <input
              v-model="username"
              autocomplete="username"
              required
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
              placeholder="Your username"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-slate-600">Password</span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
              placeholder="Your password"
            />
          </label>
        </div>

        <!-- Model selector -->
        <label class="block">
          <span class="text-sm font-medium text-slate-600">AI Model</span>
          <select
            v-model="selectedModel"
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition bg-white"
          >
            <option v-for="m in MODELS" :key="m.id" :value="m.id">
              {{ m.label }}
            </option>
          </select>
        </label>

        <!-- Text input -->
        <label class="block">
          <span class="text-sm font-medium text-slate-600">Text to refine</span>
          <textarea
            v-model="text"
            rows="6"
            required
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition resize-y"
            placeholder="Paste your text here..."
          />
        </label>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {{ loading ? "Polishing..." : "Polish Text" }}
        </button>
      </form>

      <!-- Error -->
      <div
        v-if="errorMessage"
        role="alert"
        class="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ errorMessage }}
      </div>

      <!-- Result -->
      <section
        v-if="polishedText"
        class="mt-6 rounded-2xl border border-green-200 bg-white shadow-md p-6"
      >
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-lg font-semibold text-slate-800">✨ Polished Text</h2>
          <button
            @click="copyPolishedText"
            class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition cursor-pointer"
          >
            <svg
              v-if="!copied"
              xmlns="http://www.w3.org/2000/svg"
              class="size-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            <svg
              v-else
              xmlns="http://www.w3.org/2000/svg"
              class="size-3.5 text-green-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {{ copied ? "Copied!" : "Copy" }}
          </button>
        </div>
        <p class="text-slate-700 whitespace-pre-wrap leading-relaxed">
          {{ polishedText }}
        </p>
      </section>

      <!-- Footer -->
      <footer class="mt-10 text-center text-xs text-slate-400">
        Powered by Cloudflare Workers AI · Models may vary in speed and quality
      </footer>
    </main>
  </div>
</template>
