import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 30

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const contentType = request.headers.get("content-type") ?? ""

  try {
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      const file = formData.get("file")
      if (!file || !(file instanceof Blob)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const { parseJobProfileFromPDF } = await import("@/lib/ai/gemini-provider")
      const result = await parseJobProfileFromPDF(buffer)
      return NextResponse.json(result)
    } else {
      const body = await request.json()
      const text = String(body.text ?? "").trim()
      if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 })
      const { parseJobProfileFromText } = await import("@/lib/ai/gemini-provider")
      const result = await parseJobProfileFromText(text)
      return NextResponse.json(result)
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
