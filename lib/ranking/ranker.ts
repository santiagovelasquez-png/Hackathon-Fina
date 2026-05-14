import type { CandidateScore, PublicUTL, UTLJobProfile } from "@/lib/utl/schema"
import { computeScore } from "@/lib/scoring/engine"

export interface RankEntry {
  candidate_id: string
  public_utl: PublicUTL
  score: CandidateScore
  rank: number
  profile_summary: {
    current_title: string | null
    total_experience_months: number
    top_skills: string[]
    location_summary: string | null
    languages: string[]
    confidence_score: number
  }
}

export function rankCandidates(
  candidates: Array<{ id: string; public_utl: PublicUTL }>,
  job: UTLJobProfile
): RankEntry[] {
  const scored = candidates.map((c) => ({
    candidate_id: c.id,
    public_utl: c.public_utl,
    score: computeScore(c.public_utl, job),
  }))

  // Excluded candidates go to bottom, sorted by exclusion reason alphabetically for stability
  const active = scored.filter((c) => !c.score.exclusion_reason)
  const excluded = scored.filter((c) => c.score.exclusion_reason)

  active.sort((a, b) => b.score.total_score - a.score.total_score)

  const all = [...active, ...excluded]

  return all.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
    profile_summary: buildProfileSummary(entry.public_utl),
  }))
}

function buildProfileSummary(utl: PublicUTL): RankEntry["profile_summary"] {
  const locationParts: string[] = []
  if (utl.location.city) locationParts.push(utl.location.city)
  if (utl.location.country) locationParts.push(utl.location.country)
  if (utl.location.remote) locationParts.push("Remote OK")

  return {
    current_title: utl.current_title,
    total_experience_months: utl.total_experience_months,
    top_skills: utl.skills.slice(0, 5).map((s) => s.name),
    location_summary: locationParts.length > 0 ? locationParts.join(" · ") : null,
    languages: utl.languages.map((l) => l.code.toUpperCase()),
    confidence_score: utl.confidence_score,
  }
}
