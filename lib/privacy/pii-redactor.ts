import type { PublicUTL } from "@/lib/utl/schema"

export type AccessLevel = "profile_summary" | "full_utl" | "pii"

export interface RedactedProfile {
  current_title: string | null
  total_experience_months: number
  top_skills: string[]
  location_summary: string | null
  languages: string[]
  confidence_score: number
}

/** Returns a redacted profile summary safe for company ranking views. */
export function toProfileSummary(utl: PublicUTL): RedactedProfile {
  const topSkills = utl.skills
    .filter((s) => s.category === "technical" || s.category === "tool")
    .sort((a, b) => (b.years_of_experience ?? 0) - (a.years_of_experience ?? 0))
    .slice(0, 5)
    .map((s) => s.name)

  const locationParts: string[] = []
  if (utl.location.city) locationParts.push(utl.location.city)
  if (utl.location.country) locationParts.push(utl.location.country)
  if (utl.location.remote) locationParts.push("Remote OK")

  const languages = utl.languages.map((l) => `${l.code.toUpperCase()} (${l.proficiency})`)

  return {
    current_title: utl.current_title,
    total_experience_months: utl.total_experience_months,
    top_skills: topSkills,
    location_summary: locationParts.length > 0 ? locationParts.join(" · ") : null,
    languages,
    confidence_score: utl.confidence_score,
  }
}

/** Returns the full public UTL (no PII — PII is in candidate_private_data). */
export function toFullUTL(utl: PublicUTL): PublicUTL {
  return utl
}
