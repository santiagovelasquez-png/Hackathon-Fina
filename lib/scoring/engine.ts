import type { PublicUTL, CandidateScore, ScoreDimension, UTLJobProfile } from "@/lib/utl/schema"
import {
  scoreSkillsMatch,
  scoreExperience,
  scoreCompetencies,
  scoreEducation,
  scoreCompleteness,
} from "./dimensions"

export const ENGINE_VERSION = "2.0.0"

// Weights must sum to 1.0
const DEFAULT_WEIGHTS: Record<ScoreDimension["dimension"], number> = {
  skills_match: 0.35,
  experience: 0.25,
  competencies: 0.20,
  education: 0.10,
  completeness: 0.10,
}

export type MatchTier = "FUERTE" | "BUENO" | "PARCIAL" | "DÉBIL"

export function getMatchTier(score: number): MatchTier {
  if (score >= 7.0) return "FUERTE"
  if (score >= 5.0) return "BUENO"
  if (score >= 3.0) return "PARCIAL"
  return "DÉBIL"
}

function anySkillOverlap(utl: PublicUTL, job: UTLJobProfile): boolean {
  const candidateSkills = utl.skills.map((s) => s.name.toLowerCase())
  return job.required_skills.some((req) => {
    const r = req.name.toLowerCase()
    return candidateSkills.some((c) => c === r || c.includes(r) || r.includes(c))
  })
}

// V2: soft multipliers — no more forced total_score = 0
function computeExclusionMultiplier(utl: PublicUTL, job: UTLJobProfile): { multiplier: number; reason: string | null } {
  if (!job.location.remote_ok && job.location.country && utl.location.country) {
    if (utl.location.country !== job.location.country) {
      return {
        multiplier: 0.4,
        reason: `Ubicación: cargo en ${job.location.country}, candidato en ${utl.location.country}`,
      }
    }
  }

  if (job.required_skills.length > 0 && utl.skills.length > 0) {
    if (!anySkillOverlap(utl, job)) {
      return {
        multiplier: 0.5,
        reason: "Sin solapamiento de skills detectado",
      }
    }
  }

  return { multiplier: 1.0, reason: null }
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

  const rawTotal = breakdown.reduce((sum, d) => sum + d.score * d.weight, 0)
  const { multiplier, reason } = computeExclusionMultiplier(utl, job)
  const total_score = Math.max(1, Math.min(10, Math.round(rawTotal * multiplier * 10) / 10))

  return {
    total_score,
    breakdown,
    exclusion_reason: reason,
    engine_version: ENGINE_VERSION,
    computed_at: new Date().toISOString(),
  }
}
