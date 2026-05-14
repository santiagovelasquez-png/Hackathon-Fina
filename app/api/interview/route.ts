import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { selectQuestions } from "@/lib/interview/question-selector"
import { createHash, randomBytes } from "crypto"
import type { UTLJobProfile } from "@/lib/utl/schema"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: { candidate_id?: string; job_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { candidate_id, job_id } = body
  if (!candidate_id || !job_id) {
    return NextResponse.json({ error: "candidate_id and job_id required" }, { status: 400 })
  }

  const service = createServiceClient()

  // Verify job belongs to user's company
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()
  if (!membership) return NextResponse.json({ error: "No company" }, { status: 403 })

  const { data: job } = await service
    .from("jobs")
    .select("id, company_id, utl_job_profile")
    .eq("id", job_id)
    .eq("company_id", membership.company_id)
    .single()

  if (!job) return NextResponse.json({ error: "Job not found or access denied" }, { status: 404 })

  const jobProfile = job.utl_job_profile as UTLJobProfile

  // Select questions using AI (Groq) or deterministic fallback
  const questions = await selectQuestions(jobProfile)

  // Generate secure token
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { data: session, error } = await service
    .from("interview_sessions")
    .insert({
      candidate_id,
      job_id,
      channel: "simulator",
      status: "pending",
      current_question_index: 0,
      answers: {},
      access_token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (error || !session) {
    return NextResponse.json({ error: "Failed to create session", details: error?.message }, { status: 500 })
  }

  // Store selected questions in normalized_inputs for reference
  await service.from("normalized_inputs").insert({
    candidate_id,
    raw_text: JSON.stringify(questions.map((q) => q.id)),
    adapter_used: "manual",
    ai_draft: { selected_questions: questions },
    validation_errors: null,
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  const interviewUrl = `${appUrl}/interview/${session.id}?token=${rawToken}`

  return NextResponse.json({ session_id: session.id, interview_url: interviewUrl, expires_at: expiresAt })
}
