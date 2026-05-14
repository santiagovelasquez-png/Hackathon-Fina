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
  // Experience hard filter
  if (job.min_experience_months > 0) {
    const ratio = utl.total_experience_months / job.min_experience_months
    if (ratio < 0.25) {
      return `Insufficient experience: ${utl.total_experience_months} months vs ${job.min_experience_months} months required (below 25% threshold)`
    }
  }

  // Location hard filter (if job is not remote_ok and candidate is remote-only)
  if (!job.location.remote_ok && job.location.country) {
    if (utl.location.remote && !utl.location.country) {
      return `Location mismatch: job requires presence in ${job.location.country}, candidate listed as remote-only with no country`
    }
    if (utl.location.country && utl.location.country !== job.location.country) {
      return `Location mismatch: job requires ${job.location.country}, candidate is in ${utl.location.country}`
    }
  }

  // Required skills hard filter — if all required:true skills are missing
  if (job.required_skills.length > 0) {
    const candidateSkills = new Set(utl.skills.map((s) => s.name.toLowerCase()))
    const hardRequired = job.required_skills.filter((s) => s.required)
    const missingHard = hardRequired.filter((s) => !candidateSkills.has(s.name.toLowerCase()))

    if (hardRequired.length > 0 && missingHard.length === hardRequired.length) {
      return `Missing all required skills: ${missingHard.map((s) => s.name).join(", ")}`
    }
  }

  return null
}
