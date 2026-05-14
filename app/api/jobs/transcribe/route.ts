import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

export const runtime = "nodejs"
export const maxDuration = 60

const AUDIO_MIME_TYPES = [
  "audio/webm", "audio/webm;codecs=opus",
  "audio/mp4", "audio/ogg", "audio/wav", "audio/mpeg",
]

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini API key not configured" }, { status: 500 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("audio")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No audio provided" }, { status: 400 })
  }

  const mimeType = file.type || "audio/webm"
  const base = mimeType.split(";")[0]
  if (!AUDIO_MIME_TYPES.some((t) => mimeType.startsWith(t.split(";")[0]))) {
    return NextResponse.json({ error: `Unsupported audio type: ${mimeType}` }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  if (buffer.length < 1000) {
    return NextResponse.json({ error: "Audio too short or empty" }, { status: 400 })
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: `You are a professional audio transcriber. Transcribe the audio accurately and completely.
Rules:
- Return ONLY the transcribed text. No commentary, no labels, no formatting.
- Preserve technical terms, tool names, and proper nouns exactly as spoken.
- The speaker is describing a job position in Spanish or English — recognize HR vocabulary.
- If the audio is unclear in parts, do your best and keep going.
- Never add "[inaudible]" markers — just transcribe what you can.`,
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    })

    const result = await model.generateContent([
      {
        inlineData: {
          data: buffer.toString("base64"),
          mimeType: base as "audio/webm",
        },
      },
      { text: "Transcribe this audio:" },
    ])

    const transcript = result.response.text().trim()
    if (!transcript) {
      return NextResponse.json({ error: "No speech detected in audio" }, { status: 422 })
    }

    return NextResponse.json({ transcript })
  } catch (err) {
    console.error("[transcribe]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
