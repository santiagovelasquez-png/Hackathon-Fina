import { createHash, randomBytes } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { computeScore } from "@/lib/scoring/engine"
import type { PublicUTL, UTLJobProfile } from "@/lib/utl/schema"

const SCORE_THRESHOLD = 3.0
const MAX_OPPORTUNITIES = 5

function buildTelegramUrl(rawToken: string): string {
  const raw = process.env.TELEGRAM_BOT_USERNAME ?? ""
  const username = raw.replace(/^@/, "").trim() // strip leading @ if present
  if (!username) {
    console.error("[matching] TELEGRAM_BOT_USERNAME is not set — deep link will be invalid. Set it in Vercel env vars (e.g. OpenScouting_Bot)")
  }
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

  // Generate custom interview questions for this specific job using Gemini
  let questions: Array<{ id: string; competency_name: string; question_text: string; tags: string[] }>
  try {
    const { generateInterviewQuestions } = await import("@/lib/ai/gemini-provider")
    questions = await generateInterviewQuestions(jobProfile as Parameters<typeof generateInterviewQuestions>[0])
    console.log(`[matching] Generated ${questions.length} custom questions for job=${jobId}`)
  } catch (e) {
    console.warn("[matching] Question generation failed, using bank fallback:", e)
    const { QUESTION_BANK } = await import("@/lib/interview/question-bank")
    questions = QUESTION_BANK.slice(0, 6)
  }

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = createHash("sha256").update(rawToken).digest("hex")
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

  // Store questions on the session itself (answers.__questions__) — webhook reads them from here
  const { data: session, error: sessionError } = await service
    .from("interview_sessions")
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      channel: "telegram",
      status: "pending",
      current_question_index: 0,
      answers: { __questions__: questions },
      access_token_hash: tokenHash,
      expires_at: expiresAt,
    })
    .select("id")
    .single()

  if (sessionError || !session) {
    console.error("[matching] Failed to create session:", sessionError)
    return
  }

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

  // Full scan — pre-filtering by skills_tags is an optimization added later
  const { data: candidates, error: candidatesError } = await service
    .from("candidates")
    .select("id, public_utl")
    .not("user_id", "is", null)

  if (candidatesError) {
    console.error("[matching] Failed to fetch candidates:", candidatesError.message)
    return
  }

  console.log(`[matching] job=${jobId}: ${candidates?.length ?? 0} candidates to score`)
  if (!candidates || candidates.length === 0) {
    console.log("[matching] No talent candidates found (user_id IS NOT NULL)")
    return
  }

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
