import type { PublicUTL, ScoreDimension, UTLJobProfile } from "@/lib/utl/schema"

// Each function returns a score 1-10 for its dimension.
// All logic is deterministic — no AI calls here.

// Canonical skill name → list of aliases (all lowercase)
const SKILL_ALIASES: Record<string, string[]> = {
  "javascript": ["js", "ecmascript", "es6", "es2015", "vanilla js", "vanillajs"],
  "typescript": ["ts"],
  "python": ["py", "python3", "python 3"],
  "react": ["reactjs", "react.js", "react js"],
  "react native": ["react-native"],
  "node.js": ["nodejs", "node", "node js"],
  "postgresql": ["postgres", "psql", "pg", "postgre"],
  "machine learning": ["ml", "machine-learning", "deep learning", "aprendizaje automático", "ia", "inteligencia artificial"],
  "artificial intelligence": ["ai", "ia", "inteligencia artificial"],
  "css": ["scss", "sass", "tailwind", "tailwindcss", "styled-components", "less"],
  "sql": ["mysql", "postgresql", "sqlite", "mssql", "t-sql", "plsql"],
  "docker": ["containers", "containerization", "contenedores"],
  "kubernetes": ["k8s", "k 8 s"],
  "rest": ["rest api", "restful", "rest apis", "http api", "apis", "web api"],
  "graphql": ["graph ql", "graph-ql"],
  "mongodb": ["mongo", "mongo db"],
  "redis": ["redis cache", "cache"],
  "aws": ["amazon web services", "amazon aws", "cloud aws"],
  "gcp": ["google cloud", "google cloud platform"],
  "azure": ["microsoft azure", "ms azure"],
  "git": ["github", "gitlab", "bitbucket", "version control", "control de versiones"],
  "java": ["java ee", "java se", "jvm"],
  "c#": ["csharp", "c sharp", ".net"],
  "php": ["laravel", "symfony", "wordpress"],
  "swift": ["swiftui", "ios development"],
  "kotlin": ["android", "android development"],
  "rust": ["rust lang"],
  "go": ["golang", "go lang"],
  "excel": ["microsoft excel", "spreadsheet", "hojas de cálculo"],
  "tableau": ["power bi", "looker", "data visualization", "visualización de datos"],
  "figma": ["sketch", "adobe xd", "ui design", "ux design", "diseño ui", "diseño ux"],
  "scrum": ["agile", "agile methodology", "metodología ágil", "kanban"],
  "linux": ["unix", "bash", "shell", "command line"],
}

// Build reverse lookup: alias → canonical name
const ALIAS_TO_CANONICAL: Record<string, string> = {}
for (const [canonical, aliases] of Object.entries(SKILL_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias] = canonical
  }
}

function normalizeSkill(name: string): string {
  const lower = name.toLowerCase().trim()
  return ALIAS_TO_CANONICAL[lower] ?? lower
}

const PROFICIENCY_SCORE: Record<string, number> = {
  expert: 10,
  advanced: 8,
  intermediate: 6,
  beginner: 4,
}

export function scoreSkillsMatch(utl: PublicUTL, job: UTLJobProfile): ScoreDimension {
  const rules_fired: string[] = []

  if (utl.skills.length === 0) {
    rules_fired.push("no_skills_in_utl")
    return {
      dimension: "skills_match",
      score: 3,
      weight: 0,
      explanation: "No skills found in candidate profile",
      rules_fired,
    }
  }

  if (job.required_skills.length === 0) {
    rules_fired.push("no_skills_in_job")
    return {
      dimension: "skills_match",
      score: 5,
      weight: 0,
      explanation: "Job has no required skills defined — neutral score",
      rules_fired,
    }
  }

  // Build candidate skill lookup: normalized name → best proficiency score found
  const candidateSkillMap = new Map<string, { score: number; category: string }>()
  for (const skill of utl.skills) {
    const normalized = normalizeSkill(skill.name)
    const profScore = PROFICIENCY_SCORE[skill.proficiency ?? ""] ?? 7
    const existing = candidateSkillMap.get(normalized)
    if (!existing || profScore > existing.score) {
      candidateSkillMap.set(normalized, { score: profScore, category: skill.category })
    }
  }

  function findBestMatch(required: string): { score: number; category: string } | null {
    const normalizedReq = normalizeSkill(required)

    // 1. Exact normalized match
    const exact = candidateSkillMap.get(normalizedReq)
    if (exact) return exact

    // 2. Substring fuzzy match across all candidate skills
    let best: { score: number; category: string } | null = null
    for (const [candidateNorm, data] of candidateSkillMap) {
      if (candidateNorm.includes(normalizedReq) || normalizedReq.includes(candidateNorm)) {
        if (!best || data.score > best.score) best = data
      }
    }
    return best
  }

  let weightedScore = 0
  let totalWeight = 0

  for (const required of job.required_skills) {
    const matchData = findBestMatch(required.name)
    // Category multiplier: soft/domain skills count less for technical match quality
    const categoryMult = matchData && (matchData.category === "soft" || matchData.category === "domain") ? 0.7 : 1.0
    const weight = required.weight

    if (matchData) {
      const contribution = matchData.score * categoryMult * weight
      weightedScore += contribution
      rules_fired.push(`skill_match:${required.name}(prof=${matchData.score},cat_mult=${categoryMult})`)
    } else if (required.required) {
      weightedScore += 1 * weight
      rules_fired.push(`skill_missing_required:${required.name}`)
    } else {
      weightedScore += 4 * weight
      rules_fired.push(`skill_missing_optional:${required.name}`)
    }

    totalWeight += weight
  }

  const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 5
  const score = Math.max(1, Math.min(10, Math.round(rawScore * 10) / 10))
  const matchCount = rules_fired.filter((r) => r.startsWith("skill_match:")).length

  return {
    dimension: "skills_match",
    score,
    weight: 0,
    explanation: `Matched ${matchCount} of ${job.required_skills.length} skills (with proficiency weighting)`,
    rules_fired,
  }
}

export function scoreExperience(utl: PublicUTL, job: UTLJobProfile): ScoreDimension {
  const rules_fired: string[] = []
  const months = utl.total_experience_months
  const required = job.min_experience_months

  let score: number

  if (required === 0) {
    score = months > 0 ? Math.min(10, 5 + months / 24) : 5
    rules_fired.push("no_min_experience_required")
  } else {
    const ratio = months / required
    // Smooth curve — no abrupt jumps
    if (ratio >= 1.5) {
      score = 10
      rules_fired.push("experience_exceeds_150pct")
    } else if (ratio >= 1.0) {
      score = 8
      rules_fired.push("experience_meets_requirement")
    } else if (ratio >= 0.75) {
      score = 6
      rules_fired.push("experience_75pct_of_required")
    } else if (ratio >= 0.5) {
      score = 5
      rules_fired.push("experience_50pct_of_required")
    } else if (ratio >= 0.25) {
      score = 3
      rules_fired.push("experience_25pct_of_required")
    } else {
      score = 1
      rules_fired.push("experience_below_25pct")
    }
  }

  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10))

  return {
    dimension: "experience",
    score,
    weight: 0,
    explanation: `${months} months actual vs ${required} months required (${Math.round((months / Math.max(required, 1)) * 100)}%)`,
    rules_fired,
  }
}

export function scoreCompetencies(utl: PublicUTL, job: UTLJobProfile): ScoreDimension {
  const rules_fired: string[] = []

  if (job.competencies.length === 0) {
    rules_fired.push("no_competencies_in_job")
    return {
      dimension: "competencies",
      score: 5,
      weight: 0,
      explanation: "No competencies defined for this job — neutral score",
      rules_fired,
    }
  }

  const evidenceByCompetency = new Map<string, number>()
  for (const ev of utl.competency_evidence) {
    const key = ev.competency_name.toLowerCase()
    const existing = evidenceByCompetency.get(key) ?? 0
    const scoreProxy = ev.competency_score ?? ev.confidence_score * 10
    evidenceByCompetency.set(key, Math.max(existing, scoreProxy))
  }

  let weightedScore = 0
  let totalWeight = 0

  for (const comp of job.competencies) {
    const key = comp.name.toLowerCase()
    // Default 5 = neutral (no evidence ≠ no competency)
    const evidenceScore = evidenceByCompetency.get(key) ?? 5
    const weight = comp.weight

    weightedScore += evidenceScore * weight
    totalWeight += weight

    if (evidenceScore >= comp.minimum_score) {
      rules_fired.push(`competency_ok:${comp.name}(${evidenceScore.toFixed(1)}>=${comp.minimum_score})`)
    } else {
      rules_fired.push(`competency_low:${comp.name}(${evidenceScore.toFixed(1)}<${comp.minimum_score})`)
    }
  }

  const score = Math.max(1, Math.min(10, totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 10) / 10 : 5))

  return {
    dimension: "competencies",
    score,
    weight: 0,
    explanation: `Scored ${job.competencies.length} competencies via evidence`,
    rules_fired,
  }
}

export function scoreEducation(utl: PublicUTL): ScoreDimension {
  const rules_fired: string[] = []

  if (utl.education.length === 0) {
    rules_fired.push("no_education")
    return {
      dimension: "education",
      score: 3,
      weight: 0,
      explanation: "No education entries found",
      rules_fired,
    }
  }

  const degreeKeywords = [
    "phd", "doctor", "master", "mba", "bachelor",
    "licenciatura", "ingeniería", "engineering", "ciencias", "science",
    "arquitectura", "architecture", "medicina", "derecho", "law",
  ]
  const midKeywords = [
    "tecnólogo", "tecnologo", "técnico superior", "tecnico superior",
    "técnico", "tecnico", "bootcamp", "diplomado", "associate",
    "technician", "technology",
  ]

  const hasDegree = utl.education.some(
    (e) => e.degree && degreeKeywords.some((k) => e.degree!.toLowerCase().includes(k))
  )
  const hasMid = utl.education.some(
    (e) => e.degree && midKeywords.some((k) => e.degree!.toLowerCase().includes(k))
  )

  let score: number
  if (utl.education.some((e) => e.degree?.toLowerCase().includes("phd") || e.degree?.toLowerCase().includes("doctor"))) {
    score = 10
    rules_fired.push("has_phd")
  } else if (utl.education.some((e) => e.degree?.toLowerCase().includes("master") || e.degree?.toLowerCase().includes("mba"))) {
    score = 9
    rules_fired.push("has_masters")
  } else if (hasDegree) {
    score = 7
    rules_fired.push("has_degree")
  } else if (hasMid) {
    score = 4
    rules_fired.push("has_mid_level_education")
  } else {
    score = 5
    rules_fired.push("has_education_no_degree")
  }

  return {
    dimension: "education",
    score,
    weight: 0,
    explanation: `${utl.education.length} education entries`,
    rules_fired,
  }
}

export function scoreCompleteness(utl: PublicUTL): ScoreDimension {
  const rules_fired: string[] = []
  let points = 0
  const max = 10

  if (utl.current_title) { points += 1; rules_fired.push("has_title") }
  if (utl.experiences.length > 0) { points += 2; rules_fired.push("has_experiences") }
  if (utl.skills.length >= 3) { points += 2; rules_fired.push("has_skills_3plus") }
  if (utl.education.length > 0) { points += 1; rules_fired.push("has_education") }
  if (utl.location.country) { points += 1; rules_fired.push("has_country") }
  if (utl.languages.length > 0) { points += 1; rules_fired.push("has_languages") }
  if (utl.competency_evidence.length > 0) { points += 1; rules_fired.push("has_evidence") }
  if (utl.confidence_score > 0.6) { points += 1; rules_fired.push("high_confidence") }

  const score = Math.max(1, Math.min(10, points))

  return {
    dimension: "completeness",
    score,
    weight: 0,
    explanation: `Profile completeness: ${points}/${max} fields populated`,
    rules_fired,
  }
}
