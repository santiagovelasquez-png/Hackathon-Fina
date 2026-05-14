import type { AIProvider } from "./provider"
import { mockProvider } from "./mock-provider"

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

  if (process.env.GROQ_API_KEY) {
    _provider = await getGroqProvider()
    console.info("[AI] Using Groq provider (llama-3.3-70b-versatile)")
  } else if (process.env.ANTHROPIC_API_KEY) {
    _provider = await getAnthropicProvider()
    console.info("[AI] Using Anthropic provider")
  } else {
    console.warn("[AI] No API key found — using mock provider")
    _provider = mockProvider
  }

  return _provider
}
