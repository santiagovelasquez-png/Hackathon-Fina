import type { PublicUTL, CandidateScore, ScoreDimension, UTLJobProfile } from "@/lib/utl/schema"
import {
  scoreSkillsMatch,
  scoreExperience,
  scoreCompetencies,
  scoreEducation,
  scoreCompleteness,
} from "./dimensions"

export const ENGINE_VERSION = "1.0.0"

// Weights must sum to 1.0
const DEFAULT_WEIGHTS: Record<ScoreDimension["dimension"], number> = {
  skills_match: 0.35,
  experience: 0.25,
  competencies: 0.20,
  education: 0.10,
  completeness: 0.10,
}

export function computeScore(utl: PublicUTL, job: UTLJobProfile): CandidateScore {
  const rawDimensions = [
    scoreSkillsMatch(utl, job),
    scoreExperience(utl, job),
    scoreCompetencies(utl, job),
    scoreEducation(utl),
    scoreCompleteness(utl),
  ]

  const breakdown: ScoreDimension[] = rawDimensions.map((d) => ({
    ...d,
    weight: DEFAULT_WEIGHTS[d.dimension],
  }))

  const total_score = breakdown.reduce((sum, d) => sum + d.score * d.weight, 0)
  const clamped = Math.max(1, Math.min(10, Math.round(total_score * 10) / 10))

  const exclusion_reason = checkHardExclusions(utl, job)

  return {
    total_score: exclusion_reason ? 0 : clamped,
    breakdown,
    exclusion_reason,
    engine_version: ENGINE_VERSION,
    computed_at: new Date().toISOString(),
  }
}

function checkHardExclusions(utl: PublicUTL, job: UTLJobProfile): string | null {
  // Location hard filter — only exclude if job is explicitly onsite in a country
  // and candidate has a DIFFERENT confirmed country (not just remote preference)
  if (!job.location.remote_ok && job.location.country && utl.location.country) {
    if (utl.location.country !== job.location.country) {
      return `Location mismatch: job requires ${job.location.country}, candidate is in ${utl.location.country}`
    }
  }

  // Skills hard filter — only exclude if candidate has ZERO fuzzy overlap with
  // any required skill (even optional ones). Avoids excluding partial matches.
  if (job.required_skills.length > 0 && utl.skills.length > 0) {
    const candidateSkills = utl.skills.map((s) => s.name.toLowerCase())
    const anyMatch = job.required_skills.some((req) => {
      const r = req.name.toLowerCase()
      return candidateSkills.some((c) => c === r || c.includes(r) || r.includes(c))
    })
    if (!anyMatch) {
      return `No skill overlap: candidate skills [${candidateSkills.slice(0, 3).join(", ")}...] vs job requires [${job.required_skills.slice(0, 3).map((s) => s.name).join(", ")}...]`
    }
  }

  return null
}
