import type { AIProvider } from "./provider"
import { mockProvider } from "./mock-provider"

function hasGemini() {
  return !!(process.env.GEMINI_API_KEY)
}

async function getGeminiProvider(): Promise<AIProvider> {
  const { geminiProvider } = await import("./gemini-provider")
  return geminiProvider
}

async function getGroqProvider(): Promise<AIProvider> {
  const { groqProvider } = await import("./groq-provider")
  return groqProvider
}

async function getAnthropicProvider(): Promise<AIProvider> {
  const { anthropicProvider } = await import("./anthropic-provider")
  return anthropicProvider
}

let _provider: AIProvider | null = null

export async function getAIProvider(): Promise<AIProvider> {
  if (_provider) return _provider

  if (hasGemini()) {
    _provider = await getGeminiProvider()
    console.info("[AI] Using Gemini provider (2.5 Pro extraction / 2.0 Flash evaluation)")
  } else if (process.env.GROQ_API_KEY) {
    _provider = await getGroqProvider()
    console.info("[AI] Using Groq provider (llama-3.3-70b)")
  } else if (process.env.ANTHROPIC_API_KEY) {
    _provider = await getAnthropicProvider()
    console.info("[AI] Using Anthropic provider")
  } else {
    console.warn("[AI] No API key found — using mock provider")
    _provider = mockProvider
  }

  return _provider
}

export { hasGemini }
