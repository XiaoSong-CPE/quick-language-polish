<script setup lang="ts">
import { useLocalStorage, useClipboard } from "@vueuse/core";
import { ref } from "vue";
import { useI18n } from "vue-i18n";

const { t, locale } = useI18n();

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
  { code: "zh-CN", label: "简体中文" },
] as const;

const MODELS = [
  { id: "@cf/meta/llama-4-scout-17b-16e-instruct", label: "Llama 4 Scout 17B" },
  { id: "@cf/qwen/qwen3-30b-a3b-fp8", label: "Qwen 3 30B" },
  { id: "@cf/google/gemma-4-26b-a4b-it", label: "Gemma 4 26B" },
  { id: "@cf/openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "@cf/moonshotai/kimi-k2.6", label: "Kimi K2.6" },
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
    errorMessage.value = t("errors.emptyText");
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
        errorMessage.value = t("errors.authFailed");
      } else if (errorBody?.code === "AI_REFUSAL") {
        errorMessage.value = errorBody.error ?? t("errors.modelRefused");
      } else {
        errorMessage.value =
          errorBody?.error ??
          t("errors.statusCode", { status: response.status });
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
      errorMessage.value = t("errors.noResponseBody");
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
      errorMessage.value = t("errors.modelRefused");
      polishedText.value = "";
    }
  } catch {
    errorMessage.value = t("errors.unexpected");
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
      <!-- Language switcher + GitHub link -->
      <div class="flex justify-end items-center gap-3 mb-4">
        <a
          href="https://github.com/XiaoSong-CPE/quick-language-polish"
          target="_blank"
          rel="noopener noreferrer"
          class="text-slate-500 hover:text-slate-800 transition"
          :title="t('githubRepo')"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="size-5"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
            />
          </svg>
        </a>
        <div
          class="relative inline-flex rounded-lg border border-slate-300 bg-white p-1 shadow-sm"
        >
          <button
            v-for="lang in LANGUAGES"
            :key="lang.code"
            @click="locale = lang.code"
            :class="[
              'px-3 py-1 text-xs font-medium rounded-md transition cursor-pointer',
              locale === lang.code
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100',
            ]"
          >
            {{ lang.label }}
          </button>
        </div>
      </div>

      <header class="mb-8 text-center">
        <h1 class="text-4xl font-bold text-slate-800 tracking-tight">
          {{ t("title") }}
        </h1>
        <p class="mt-2 text-slate-500">
          {{ t("subtitle") }}
        </p>
      </header>

      <form
        @submit.prevent="polishText"
        class="space-y-5 bg-white rounded-2xl shadow-md border border-slate-200 p-6"
      >
        <!-- Auth row -->
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm font-medium text-slate-600">
              {{ t("username") }}
            </span>
            <input
              v-model="username"
              autocomplete="username"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
              :placeholder="t('usernamePlaceholder')"
            />
          </label>
          <label class="block">
            <span class="text-sm font-medium text-slate-600">
              {{ t("password") }}
            </span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition"
              :placeholder="t('passwordPlaceholder')"
            />
          </label>
        </div>

        <!-- Model selector -->
        <label class="block">
          <span class="text-sm font-medium text-slate-600">
            {{ t("model") }}
          </span>
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
          <span class="text-sm font-medium text-slate-600">
            {{ t("textLabel") }}
          </span>
          <textarea
            v-model="text"
            rows="6"
            required
            class="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200 focus:outline-none transition resize-y"
            :placeholder="t('textPlaceholder')"
          />
        </label>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
        >
          {{ loading ? t("polishing") : t("polishButton") }}
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
          <h2 class="text-lg font-semibold text-slate-800">
            {{ t("polishedTitle") }}
          </h2>
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
            {{ copied ? t("copied") : t("copy") }}
          </button>
        </div>
        <p class="text-slate-700 whitespace-pre-wrap leading-relaxed">
          {{ polishedText }}
        </p>
      </section>

      <!-- Footer -->
      <footer class="mt-10 text-center text-xs text-slate-400">
        {{ t("footer") }}
      </footer>
    </main>
  </div>
</template>
