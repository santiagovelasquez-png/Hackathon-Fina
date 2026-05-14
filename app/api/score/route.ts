import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { computeScore } from "@/lib/scoring/engine"
import { logAuditEvent } from "@/lib/audit/logger"
import { PublicUTLSchema, UTLJobProfileSchema } from "@/lib/utl/schema"

export const runtime = "nodejs"

// POST /api/score
// Body: { candidate_id: string, job_id: string }
// Computes score + upserts candidate_scores + updates/inserts ranking_results
export async function POST(request: NextRequest) {
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

  const [{ data: candidateRow, error: candErr }, { data: jobRow, error: jobErr }] =
    await Promise.all([
      service.from("candidates").select("id, public_utl").eq("id", candidate_id).single(),
      service.from("jobs").select("id, company_id, utl_job_profile").eq("id", job_id).single(),
    ])

  if (candErr || !candidateRow) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 })
  }
  if (jobErr || !jobRow) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 })
  }

  const utlParse = PublicUTLSchema.safeParse(candidateRow.public_utl)
  const jobParse = UTLJobProfileSchema.safeParse(jobRow.utl_job_profile)

  if (!utlParse.success) {
    return NextResponse.json({ error: "Candidate UTL schema invalid" }, { status: 422 })
  }
  if (!jobParse.success) {
    return NextResponse.json({ error: "Job profile schema invalid" }, { status: 422 })
  }

  const score = computeScore(utlParse.data, jobParse.data)

  await service.from("candidate_scores").upsert(
    {
      candidate_id,
      job_id,
      total_score: score.total_score,
      breakdown: score.breakdown,
      exclusion_reason: score.exclusion_reason,
      engine_version: score.engine_version,
      computed_at: score.computed_at,
    },
    { onConflict: "candidate_id,job_id" }
  )

  const profileSummary = {
    current_title: utlParse.data.current_title,
    total_experience_months: utlParse.data.total_experience_months,
    top_skills: utlParse.data.skills.slice(0, 5).map((s) => s.name),
    location_summary: buildLocationSummary(utlParse.data),
    languages: utlParse.data.languages.map((l) => l.code.toUpperCase()),
    confidence_score: utlParse.data.confidence_score,
  }

  await service.from("ranking_results").upsert(
    {
      company_id: jobRow.company_id,
      job_id,
      candidate_id,
      score_snapshot: score.total_score,
      profile_summary: profileSummary,
      pii_unlocked: false,
    },
    { onConflict: "job_id,candidate_id" }
  )

  await logAuditEvent({
    actor_id: null,
    company_id: jobRow.company_id,
    action: "score_candidate",
    resource_type: "candidate_score",
    resource_id: candidate_id,
    metadata: { job_id, total_score: score.total_score, exclusion_reason: score.exclusion_reason },
  })

  return NextResponse.json({ score })
}

function buildLocationSummary(utl: { location: { city?: string | null; country?: string | null; remote: boolean } }): string | null {
  const parts: string[] = []
  if (utl.location.city) parts.push(utl.location.city)
  if (utl.location.country) parts.push(utl.location.country)
  if (utl.location.remote) parts.push("Remote OK")
  return parts.length > 0 ? parts.join(" · ") : null
}
