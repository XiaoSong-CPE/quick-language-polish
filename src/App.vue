<script setup lang="ts">
import ky, { HTTPError } from 'ky'
import { ref } from 'vue'

type ErrorResponse = {
  error?: string
  details?: string
  code?: string
  polishedText?: string
}

type PolishResponse = {
  polishedText: string
}

const username = ref('')
const password = ref('')
const text = ref('')
const polishedText = ref('')
const errorMessage = ref('')
const loading = ref(false)

const polishText = async () => {
  polishedText.value = ''
  errorMessage.value = ''

  if (!text.value.trim()) {
    errorMessage.value = 'Please enter text to polish.'
    return
  }

  loading.value = true

  try {
    const response = await ky
      .post('/api/polish', {
        headers: {
          Authorization: `Basic ${btoa(`${username.value}:${password.value}`)}`,
        },
        json: {
          text: text.value,
        },
      })
      .json<PolishResponse>()

    polishedText.value = response.polishedText
  } catch (error) {
    if (error instanceof HTTPError) {
      const body = await error.response.json<ErrorResponse>().catch(() => null)

      if (body?.code === 'AI_REFUSAL') {
        errorMessage.value = body.error ?? 'The AI model refused the request.'
      } else if (error.response.status === 401) {
        errorMessage.value = 'Authentication failed. Check account/password.'
      } else {
        errorMessage.value = body?.error ?? `Request failed with status ${error.response.status}.`
      }

      if (body?.details) {
        errorMessage.value = `${errorMessage.value} (${body.details})`
      }

      return
    }

    errorMessage.value = 'Unexpected error while calling the API.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main>
    <h1>Quick Language Polish</h1>

    <p>Sign in and paste text to refine it with Cloudflare Workers AI.</p>

    <form @submit.prevent="polishText">
      <label>
        Account
        <input v-model="username" autocomplete="username" required />
      </label>

      <label>
        Password
        <input v-model="password" type="password" autocomplete="current-password" required />
      </label>

      <label>
        Text to refine
        <textarea v-model="text" rows="8" required />
      </label>

      <button type="submit" :disabled="loading">{{ loading ? 'Polishing...' : 'Polish text' }}</button>
    </form>

    <p v-if="errorMessage" role="alert">{{ errorMessage }}</p>

    <section v-if="polishedText">
      <h2>Polished text</h2>
      <p>{{ polishedText }}</p>
    </section>
  </main>
</template>
