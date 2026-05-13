import type { AIProvider } from "./provider"
import { mockProvider } from "./mock-provider"

// Lazy-import anthropic provider to avoid loading SDK when not needed
async function getAnthropicProvider(): Promise<AIProvider> {
  const { anthropicProvider } = await import("./anthropic-provider")
  return anthropicProvider
}

let _provider: AIProvider | null = null

export async function getAIProvider(): Promise<AIProvider> {
  if (_provider) return _provider

  if (process.env.ANTHROPIC_API_KEY) {
    _provider = await getAnthropicProvider()
  } else {
    console.warn("[AI] No ANTHROPIC_API_KEY found — using mock provider")
    _provider = mockProvider
  }

  return _provider
}
