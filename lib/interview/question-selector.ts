import Groq from "groq-sdk"
import type { UTLJobProfile } from "@/lib/utl/schema"
import { QUESTION_BANK, DEFAULT_QUESTION_COUNT, type Question } from "./question-bank"

// AI-powered question selection: picks the 6 most relevant questions for this job.
// Falls back to deterministic selection if GROQ_API_KEY is not set.
export async function selectQuestions(job: UTLJobProfile): Promise<Question[]> {
  if (process.env.GROQ_API_KEY) {
    try {
      return await selectWithGroq(job)
    } catch (err) {
      console.warn("[interview] Groq question selection failed, falling back to deterministic", err)
    }
  }
  return selectDeterministic(job)
}

async function selectWithGroq(job: UTLJobProfile): Promise<Question[]> {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

  const jobSummary = [
    `Title: ${job.title}`,
    `Description: ${job.description.slice(0, 500)}`,
    `Required skills: ${job.required_skills.map((s) => s.name).join(", ")}`,
    `Competencies: ${job.competencies.map((c) => c.name).join(", ")}`,
    `Min experience: ${job.min_experience_months} months`,
    `Remote: ${job.location.remote_ok}`,
  ].join("\n")

  const questionList = QUESTION_BANK.map(
    (q) => `${q.id}: [${q.competency_name}] ${q.question_text} (tags: ${q.tags.join(", ")})`
  ).join("\n")

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: `Select exactly ${DEFAULT_QUESTION_COUNT} question IDs from the list that are most relevant for this job. Ensure variety across competencies. Return ONLY JSON: { "selected_ids": ["id1", "id2", ...] }`,
      },
      {
        role: "user",
        content: `JOB:\n${jobSummary}\n\nQUESTIONS:\n${questionList}`,
      },
    ],
    response_format: { type: "json_object" },
  })

  const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}")
  const selectedIds: string[] = Array.isArray(raw.selected_ids) ? raw.selected_ids : []

  const selected = selectedIds
    .map((id) => QUESTION_BANK.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined)
    .slice(0, DEFAULT_QUESTION_COUNT)

  // Pad with deterministic if AI returned fewer than needed
  if (selected.length < DEFAULT_QUESTION_COUNT) {
    const extras = selectDeterministic(job).filter((q) => !selected.some((s) => s.id === q.id))
    selected.push(...extras.slice(0, DEFAULT_QUESTION_COUNT - selected.length))
  }

  return selected
}

function selectDeterministic(job: UTLJobProfile): Question[] {
  const jobCompetencies = new Set(job.competencies.map((c) => c.name.toLowerCase()))
  const jobSkillTags = job.required_skills.map((s) => s.name.toLowerCase())

  // Score each question by relevance to job
  const scored = QUESTION_BANK.map((q) => {
    let score = 0
    if (jobCompetencies.has(q.competency_name.toLowerCase())) score += 3
    if (q.tags.some((t) => jobSkillTags.includes(t))) score += 2
    return { q, score }
  })

  // Sort by score desc, then pick one per competency for variety
  scored.sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const selected: Question[] = []

  for (const { q } of scored) {
    if (selected.length >= DEFAULT_QUESTION_COUNT) break
    if (!seen.has(q.competency_name)) {
      selected.push(q)
      seen.add(q.competency_name)
    }
  }

  // Fill remaining slots if we didn't get enough unique competencies
  for (const { q } of scored) {
    if (selected.length >= DEFAULT_QUESTION_COUNT) break
    if (!selected.includes(q)) selected.push(q)
  }

  return selected.slice(0, DEFAULT_QUESTION_COUNT)
}
