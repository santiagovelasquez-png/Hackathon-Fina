import { createHash, randomBytes } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { computeScore } from "@/lib/scoring/engine"
import { selectQuestions } from "@/lib/interview/question-selector"
import type { PublicUTL, UTLJobProfile } from "@/lib/utl/schema"

const SCORE_THRESHOLD = 6.0
const MAX_OPPORTUNITIES = 5

function buildTelegramUrl(rawToken: string): string {
  const username = process.env.TELEGRAM_BOT_USERNAME ?? ""
  return `https://t.me/${username}?start=${rawToken}`
}

async function createOpportunity(opts: {
  candidateId: string
  jobId: string
  companyId: string
  score: number
  jobProfile: UTLJobProfile
}): Promise<void> {
  const { candidateId, jobId, companyId, score, jobProfile } = opts
  const service = createServiceClient()

  // Check if opportunity already exists
  const { data: existing } = await service
    .from("talent_opportunities")
    .select("id")
    .eq("candidate_id", candidateId)
    .eq("job_id", jobId)
    .single()
  if (existing) return

  // Create interview session
  const questions = await selectQuestions(jobProfile)
  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days for talent

  const { data: session, error: sessionError } = await service
    .from("interview_sessions")
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      channel: "telegram",
      status: "pending",
      current_question_index: 0,
      answers: {},
      access_token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (sessionError || !session) {
    console.error("[matching] Failed to create session:", sessionError)
    return
  }

  // Store selected questions
  await Promise.resolve(service.from("normalized_inputs").insert({
    candidate_id: candidateId,
    raw_text: JSON.stringify(questions.map((q) => q.id)),
    adapter_used: "matching-pipeline",
    ai_draft: { selected_questions: questions },
    validation_errors: null,
  })).catch(() => {})

  const telegramUrl = buildTelegramUrl(rawToken)

  await service.from("talent_opportunities").insert({
    candidate_id: candidateId,
    job_id: jobId,
    company_id: companyId,
    status: "pending",
    score,
    telegram_url: telegramUrl,
    session_id: session.id,
  })
}

export async function matchTalentsToJob(jobId: string, companyId: string): Promise<void> {
  const service = createServiceClient()

  const { data: job } = await service
    .from("jobs")
    .select("utl_job_profile")
    .eq("id", jobId)
    .single()

  if (!job) return
  const jobProfile = job.utl_job_profile as UTLJobProfile

  // Try skills_tags GIN pre-filter; fall back to full scan if column missing
  const requiredTags = (jobProfile.required_skills ?? [])
    .filter((s) => s.required)
    .map((s) => s.name.toLowerCase())

  let candidates: Array<{ id: string; public_utl: unknown }> | null = null

  if (requiredTags.length > 0) {
    const { data, error } = await service
      .from("candidates")
      .select("id, public_utl")
      .not("user_id", "is", null)
      .overlaps("skills_tags", requiredTags)

    if (!error) {
      candidates = data
    } else {
      console.warn("[matching] skills_tags filter failed (column missing?), falling back to full scan:", error.message)
    }
  }

  // Full scan fallback
  if (candidates === null) {
    const { data } = await service
      .from("candidates")
      .select("id, public_utl")
      .not("user_id", "is", null)
    candidates = data
  }

  console.log(`[matching] job=${jobId}: ${candidates?.length ?? 0} candidates to score`)
  if (!candidates || candidates.length === 0) return

  // Score all qualifying candidates
  const scored: Array<{ candidateId: string; score: number }> = []
  for (const candidate of candidates) {
    try {
      const utl = candidate.public_utl as PublicUTL
      const result = computeScore(utl, jobProfile)
      if (result.total_score >= SCORE_THRESHOLD && !result.exclusion_reason) {
        scored.push({ candidateId: candidate.id, score: result.total_score })
      }
    } catch (e) {
      console.error(`[matching] Error scoring candidate ${candidate.id}:`, e)
    }
  }

  // Rank and take top MAX_OPPORTUNITIES
  const top = scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_OPPORTUNITIES)

  console.log(`[matching] job=${jobId}: ${candidates.length} candidates scored, ${scored.length} qualify, selecting top ${top.length}`)

  for (const { candidateId, score } of top) {
    try {
      await createOpportunity({ candidateId, jobId, companyId, score, jobProfile })
      console.log(`[matching] opportunity created: candidate=${candidateId} score=${score}`)
    } catch (e) {
      console.error(`[matching] failed to create opportunity for candidate=${candidateId}:`, e)
    }
  }
}

export async function matchJobsToTalent(candidateId: string): Promise<void> {
  const service = createServiceClient()

  const { data: candidate } = await service
    .from("candidates")
    .select("public_utl")
    .eq("id", candidateId)
    .single()

  if (!candidate) return
  const utl = candidate.public_utl as PublicUTL

  // Get all active jobs
  const { data: jobs } = await service
    .from("jobs")
    .select("id, company_id, utl_job_profile")
    .eq("status", "active")

  if (!jobs || jobs.length === 0) return

  for (const job of jobs) {
    try {
      const jobProfile = job.utl_job_profile as UTLJobProfile
      const result = computeScore(utl, jobProfile)

      if (result.total_score < SCORE_THRESHOLD || result.exclusion_reason) continue

      // Check if this candidate would rank in the top MAX_OPPORTUNITIES for this job
      const { data: existingOps } = await service
        .from("talent_opportunities")
        .select("score")
        .eq("job_id", job.id)
        .order("score", { ascending: false })
        .limit(MAX_OPPORTUNITIES)

      const count = existingOps?.length ?? 0
      const lowestTop = existingOps?.[count - 1]?.score ?? 0

      // Slot available OR new candidate beats the lowest in current top-5
      if (count < MAX_OPPORTUNITIES || result.total_score > lowestTop) {
        await createOpportunity({
          candidateId,
          jobId: job.id,
          companyId: job.company_id,
          score: result.total_score,
          jobProfile,
        })
      }
    } catch (e) {
      console.error(`[matching] Error scoring job ${job.id}:`, e)
    }
  }
}
