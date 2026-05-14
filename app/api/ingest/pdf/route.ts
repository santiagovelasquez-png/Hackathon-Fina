import { NextRequest, NextResponse } from "next/server"
import { extractTextFromPDF } from "@/lib/adapters/pdf"
import { getAIProvider, hasGemini } from "@/lib/ai"
import { validatePublicUTL } from "@/lib/utl/validator"
import { normalizePublicUTL } from "@/lib/utl/normalizer"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { logAuditEvent } from "@/lib/audit/logger"
import type { PublicUTL, PrivateUTL, AIExtractionOutput } from "@/lib/utl/schema"

export const runtime = "nodejs"
export const maxDuration = 60

async function extractWithBestMethod(buffer: Buffer): Promise<{ aiDraft: AIExtractionOutput; adapterUsed: string; rawText: string }> {
  // Gemini 2.5 Pro: native PDF understanding — handles image-based PDFs,
  // multi-column layouts, tables better than pdf-parse + text model
  if (hasGemini()) {
    try {
      const { extractUTLFromPDFBytes } = await import("@/lib/ai/gemini-provider")
      const aiDraft = await extractUTLFromPDFBytes(buffer)

      // Still extract text for normalized_inputs record (for audit/debug)
      let rawText = ""
      try { rawText = await extractTextFromPDF(buffer) } catch { /* best-effort */ }

      return { aiDraft, adapterUsed: "gemini_native_pdf", rawText }
    } catch (err) {
      console.warn("[ingest] Gemini native PDF failed, falling back to text extraction", err)
    }
  }

  // Fallback: pdf-parse → text → AI
  let rawText: string
  try {
    rawText = await extractTextFromPDF(buffer)
  } catch (err) {
    throw new Error(`PDF text extraction failed: ${String(err)}`)
  }

  if (rawText.trim().length < 50) {
    throw new Error("PDF appears to be empty or image-only (no extractable text)")
  }

  const ai = await getAIProvider()
  const aiDraft = await ai.extractUTL(rawText)
  return { aiDraft, adapterUsed: "pdf_text", rawText }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

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
  let rawText: string

  try {
    ;({ aiDraft, adapterUsed, rawText } = await extractWithBestMethod(buffer))
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 422 }
    )
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
    publicUTL.flags.push({
      field: "schema",
      reason: `Validation issues: ${validation.errors.map((e) => e.message).join("; ")}`,
      severity: "warning",
    })
  }

  const privateData: PrivateUTL = {
    full_name: aiDraft.private.full_name ?? "Unknown",
    email: aiDraft.private.email ?? null,
    phone: aiDraft.private.phone ?? null,
    linkedin_url: aiDraft.private.linkedin_url ?? null,
    portfolio_url: aiDraft.private.portfolio_url ?? null,
  }

  const service = createServiceClient()

  const { data: candidate, error: candidateError } = await service
    .from("candidates")
    .insert({
      public_utl: publicUTL,
      confidence_score: publicUTL.confidence_score,
      source_type: "pdf",
    })
    .select("id")
    .single()

  if (candidateError || !candidate) {
    return NextResponse.json(
      { error: "Failed to save candidate", details: candidateError?.message },
      { status: 500 }
    )
  }

  await Promise.all([
    service.from("candidate_private_data").insert({
      candidate_id: candidate.id,
      full_name: privateData.full_name,
      email: privateData.email,
      phone: privateData.phone,
      linkedin_url: privateData.linkedin_url,
      portfolio_url: privateData.portfolio_url,
    }),
    service.from("normalized_inputs").insert({
      candidate_id: candidate.id,
      raw_text: rawText || "[native pdf — no text extracted]",
      adapter_used: adapterUsed,
      ai_draft: aiDraft,
      validation_errors: validation.success ? null : validation.errors,
    }),
    logAuditEvent({
      actor_id: user?.id ?? null,
      company_id: null,
      action: "ingest_candidate",
      resource_type: "candidate",
      resource_id: candidate.id,
      metadata: {
        source_type: "pdf",
        adapter_used: adapterUsed,
        confidence_score: publicUTL.confidence_score,
        skills_count: publicUTL.skills.length,
        experience_months: publicUTL.total_experience_months,
      },
    }),
  ])

  return NextResponse.json({
    candidate_id: candidate.id,
    confidence_score: publicUTL.confidence_score,
    adapter_used: adapterUsed,
    flags: publicUTL.flags,
    preview: {
      name: privateData.full_name,
      title: publicUTL.current_title,
      experience_months: publicUTL.total_experience_months,
      skills: publicUTL.skills.slice(0, 5).map((s) => s.name),
    },
  })
}
