import { NextRequest, NextResponse } from "next/server"
import { extractTextFromPDF } from "@/lib/adapters/pdf"
import { hasGemini } from "@/lib/ai"
import { getAIProvider } from "@/lib/ai"
import { validatePublicUTL } from "@/lib/utl/validator"
import { normalizePublicUTL } from "@/lib/utl/normalizer"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import type { PublicUTL, PrivateUTL, AIExtractionOutput } from "@/lib/utl/schema"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 })
  }

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  let aiDraft: AIExtractionOutput
  let adapterUsed: string
  let rawText = ""

  try {
    if (hasGemini()) {
      const { extractUTLFromPDFBytes } = await import("@/lib/ai/gemini-provider")
      aiDraft = await extractUTLFromPDFBytes(buffer)
      try { rawText = await extractTextFromPDF(buffer) } catch { /* best-effort */ }
      adapterUsed = "gemini_native_pdf"
    } else {
      rawText = await extractTextFromPDF(buffer)
      if (rawText.trim().length < 50) throw new Error("PDF appears to be empty or image-only")
      const ai = await getAIProvider()
      aiDraft = await ai.extractUTL(rawText)
      adapterUsed = "pdf_text"
    }
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }

  const publicRaw: PublicUTL = {
    location: {
      city: aiDraft.public.location?.city ?? null,
      country: aiDraft.public.location?.country ?? null,
      remote: aiDraft.public.location?.remote ?? false,
      timezone: aiDraft.public.location?.timezone ?? null,
    },
    total_experience_months: aiDraft.public.total_experience_months ?? 0,
    current_title: aiDraft.public.current_title ?? null,
    experiences: aiDraft.public.experiences ?? [],
    education: aiDraft.public.education ?? [],
    skills: aiDraft.public.skills ?? [],
    languages: aiDraft.public.languages ?? [],
    competency_evidence: aiDraft.public.competency_evidence ?? [],
    interview_answers: aiDraft.public.interview_answers ?? [],
    confidence_score: aiDraft.public.confidence_score ?? 0.5,
    flags: aiDraft.public.flags ?? [],
  }

  const publicUTL = normalizePublicUTL(publicRaw)
  const validation = validatePublicUTL(publicUTL)
  if (!validation.success) {
    publicUTL.confidence_score = Math.min(publicUTL.confidence_score, 0.3)
  }

  const privateData: PrivateUTL = {
    full_name: aiDraft.private.full_name ?? user.email?.split("@")[0] ?? "Unknown",
    email: aiDraft.private.email ?? user.email ?? null,
    phone: aiDraft.private.phone ?? null,
    linkedin_url: aiDraft.private.linkedin_url ?? null,
    portfolio_url: aiDraft.private.portfolio_url ?? null,
  }

  const service = createServiceClient()

  // Check if talent already has a candidate profile — update instead of insert
  const { data: existing } = await service
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single()

  let candidateId: string

  if (existing) {
    await service.from("candidates").update({
      public_utl: publicUTL,
      confidence_score: publicUTL.confidence_score,
      version: existing ? undefined : 1,
    }).eq("id", existing.id)
    candidateId = existing.id
  } else {
    const { data: candidate, error } = await service
      .from("candidates")
      .insert({
        public_utl: publicUTL,
        confidence_score: publicUTL.confidence_score,
        source_type: "pdf",
        user_id: user.id,
      })
      .select("id")
      .single()

    if (error || !candidate) {
      return NextResponse.json({ error: "Failed to save candidate" }, { status: 500 })
    }
    candidateId = candidate.id
  }

  await Promise.all([
    service.from("candidate_private_data").upsert({
      candidate_id: candidateId,
      full_name: privateData.full_name,
      email: privateData.email,
      phone: privateData.phone,
      linkedin_url: privateData.linkedin_url,
      portfolio_url: privateData.portfolio_url,
    }, { onConflict: "candidate_id" }),
    Promise.resolve(service.from("normalized_inputs").insert({
      candidate_id: candidateId,
      raw_text: rawText || "[native pdf]",
      adapter_used: adapterUsed,
      ai_draft: aiDraft,
      validation_errors: validation.success ? null : validation.errors,
    })).catch(() => {}),
  ])

  // Trigger matching against all active jobs (fire-and-forget)
  import("@/lib/matching/pipeline").then(({ matchJobsToTalent }) =>
    matchJobsToTalent(candidateId).catch((e) => console.error("[talent/cv] matching failed:", e))
  )

  return NextResponse.json({
    candidate_id: candidateId,
    preview: {
      name: privateData.full_name,
      title: publicUTL.current_title,
      experience_months: publicUTL.total_experience_months,
      skills: publicUTL.skills.slice(0, 5).map((s) => s.name),
      confidence_score: publicUTL.confidence_score,
    },
  })
}
