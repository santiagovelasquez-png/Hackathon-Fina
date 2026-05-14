import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY not set" }, { status: 500 })

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
  const data = await res.json()
  const models = (data.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) =>
      m.supportedGenerationMethods?.includes("generateContent")
    )
    .map((m: { name: string }) => m.name)

  return NextResponse.json({ models })
}
