import { normalizeSkillName } from "@/lib/utils/skill-taxonomy"
import { parseToYearMonth, diffMonths } from "@/lib/utils/date"
import type { PublicUTL, Experience, Skill, UTLFlag } from "./schema"

export function normalizePublicUTL(raw: PublicUTL): PublicUTL {
  const experiences = raw.experiences.map(normalizeExperience)
  const skills = raw.skills.map(normalizeSkill)
  const total_experience_months = computeTotalExperience(experiences)
  const flags = validateCompleteness(raw)

  return {
    ...raw,
    experiences,
    skills,
    total_experience_months,
    flags: [...raw.flags, ...flags],
  }
}

function normalizeExperience(exp: Experience): Experience {
  const start = parseToYearMonth(exp.start_date)
  const end = exp.end_date ? parseToYearMonth(exp.end_date) : null
  const duration_months = end
    ? diffMonths(start, end)
    : diffMonths(start, new Date())

  return {
    ...exp,
    start_date: formatYearMonth(start),
    end_date: end ? formatYearMonth(end) : null,
    duration_months: Math.max(0, duration_months),
  }
}

function normalizeSkill(skill: Skill): Skill {
  return {
    ...skill,
    name: normalizeSkillName(skill.name),
  }
}

function computeTotalExperience(experiences: Experience[]): number {
  // Deduplicate overlapping date ranges before summing
  if (experiences.length === 0) return 0

  const ranges = experiences
    .map((e) => ({
      start: parseToYearMonth(e.start_date),
      end: e.end_date ? parseToYearMonth(e.end_date) : new Date(),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime())

  let total = 0
  let current = { ...ranges[0] }

  for (let i = 1; i < ranges.length; i++) {
    const range = ranges[i]
    if (range.start <= current.end) {
      // Overlapping — extend current if needed
      if (range.end > current.end) current.end = range.end
    } else {
      total += diffMonths(current.start, current.end)
      current = { ...range }
    }
  }
  total += diffMonths(current.start, current.end)

  return Math.max(0, total)
}

function validateCompleteness(utl: PublicUTL): UTLFlag[] {
  const flags: UTLFlag[] = []

  if (utl.experiences.length === 0) {
    flags.push({ field: "experiences", reason: "No experience entries found", severity: "warning" })
  }
  if (utl.skills.length === 0) {
    flags.push({ field: "skills", reason: "No skills found", severity: "warning" })
  }
  if (!utl.current_title) {
    flags.push({ field: "current_title", reason: "Current title not found", severity: "warning" })
  }
  if (!utl.location.country) {
    flags.push({ field: "location.country", reason: "Country not detected", severity: "warning" })
  }

  return flags
}

function formatYearMonth(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}
