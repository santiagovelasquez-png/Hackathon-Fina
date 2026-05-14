import type { PublicUTL, ScoreDimension, UTLJobProfile } from "@/lib/utl/schema"

// Each function returns a score 1-10 for its dimension.
// All logic is deterministic — no AI calls here.

export function scoreSkillsMatch(utl: PublicUTL, job: UTLJobProfile): ScoreDimension {
  const rules_fired: string[] = []

  if (utl.skills.length === 0) {
    rules_fired.push("no_skills_in_utl")
    return {
      dimension: "skills_match",
      score: 1,
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

  const candidateSkillNames = new Set(utl.skills.map((s) => s.name.toLowerCase()))

  let weightedScore = 0
  let totalWeight = 0

  for (const required of job.required_skills) {
    const skillName = required.name.toLowerCase()
    const match = candidateSkillNames.has(skillName)
    const weight = required.weight

    if (match) {
      weightedScore += 10 * weight
      rules_fired.push(`skill_match:${required.name}`)
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

  return {
    dimension: "skills_match",
    score,
    weight: 0,
    explanation: `Matched ${rules_fired.filter((r) => r.startsWith("skill_match:")).length} of ${job.required_skills.length} required skills`,
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
      score = 4
      rules_fired.push("experience_50pct_of_required")
    } else {
      score = 2
      rules_fired.push("experience_below_50pct")
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
    // Use competency_score if set by engine, otherwise use confidence_score as proxy
    const scoreProxy = ev.competency_score ?? ev.confidence_score * 10
    evidenceByCompetency.set(key, Math.max(existing, scoreProxy))
  }

  let weightedScore = 0
  let totalWeight = 0

  for (const comp of job.competencies) {
    const key = comp.name.toLowerCase()
    const evidenceScore = evidenceByCompetency.get(key) ?? 1
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

  const degreeKeywords = ["phd", "doctor", "master", "mba", "bachelor", "licenciatura", "ingeniería", "engineering", "ciencias", "science"]
  const hasDegree = utl.education.some(
    (e) => e.degree && degreeKeywords.some((k) => e.degree!.toLowerCase().includes(k))
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
