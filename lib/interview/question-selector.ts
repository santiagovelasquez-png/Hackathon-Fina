import type { UTLJobProfile } from "@/lib/utl/schema"
import { QUESTION_BANK, DEFAULT_QUESTION_COUNT, type Question } from "./question-bank"

export async function selectQuestions(job: UTLJobProfile): Promise<Question[]> {
  const jobSummary = buildJobSummary(job)
  const questionList = QUESTION_BANK.map(
    (q) => `${q.id}: [${q.competency_name}] ${q.question_text} (tags: ${q.tags.join(", ")})`
  ).join("\n")

  // Priority: Gemini Flash → Groq → deterministic
  if (process.env.GOOGLE_CLOUD_PROJECT && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const { selectQuestionsWithGemini } = await import("@/lib/ai/gemini-provider")
      const ids = await selectQuestionsWithGemini(jobSummary, questionList, DEFAULT_QUESTION_COUNT)
      const selected = resolveIds(ids)
      if (selected.length >= DEFAULT_QUESTION_COUNT) return selected
    } catch (err) {
      console.warn("[interview] Gemini question selection failed, falling back", err)
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      const ids = await selectWithGroq(jobSummary, questionList)
      const selected = resolveIds(ids)
      if (selected.length >= DEFAULT_QUESTION_COUNT) return selected
    } catch (err) {
      console.warn("[interview] Groq question selection failed, falling back", err)
    }
  }

  return selectDeterministic(job)
}

function buildJobSummary(job: UTLJobProfile): string {
  return [
    `Title: ${job.title}`,
    `Description: ${job.description.slice(0, 400)}`,
    `Required skills: ${job.required_skills.map((s) => s.name).join(", ")}`,
    `Competencies: ${job.competencies.map((c) => c.name).join(", ")}`,
    `Min experience: ${job.min_experience_months} months`,
  ].join("\n")
}

function resolveIds(ids: string[]): Question[] {
  const selected = ids
    .map((id) => QUESTION_BANK.find((q) => q.id === id))
    .filter((q): q is Question => q !== undefined)
    .slice(0, DEFAULT_QUESTION_COUNT)

  // Pad with deterministic if AI returned fewer
  if (selected.length < DEFAULT_QUESTION_COUNT) {
    const extras = QUESTION_BANK.filter((q) => !selected.some((s) => s.id === q.id))
    selected.push(...extras.slice(0, DEFAULT_QUESTION_COUNT - selected.length))
  }

  return selected
}

async function selectWithGroq(jobSummary: string, questionList: string): Promise<string[]> {
  const Groq = (await import("groq-sdk")).default
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0.1,
    max_tokens: 200,
    messages: [
      {
        role: "system",
        content: `Select exactly ${DEFAULT_QUESTION_COUNT} question IDs most relevant for this job. Vary competencies. Return ONLY JSON: { "selected_ids": ["id1", ...] }`,
      },
      { role: "user", content: `JOB:\n${jobSummary}\n\nQUESTIONS:\n${questionList}` },
    ],
    response_format: { type: "json_object" },
  })

  const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}")
  return Array.isArray(raw.selected_ids) ? raw.selected_ids : []
}

function selectDeterministic(job: UTLJobProfile): Question[] {
  const jobCompetencies = new Set(job.competencies.map((c) => c.name.toLowerCase()))
  const jobSkillTags = job.required_skills.map((s) => s.name.toLowerCase())

  const scored = QUESTION_BANK.map((q) => {
    let score = 0
    if (jobCompetencies.has(q.competency_name.toLowerCase())) score += 3
    if (q.tags.some((t) => jobSkillTags.includes(t))) score += 2
    return { q, score }
  }).sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const selected: Question[] = []

  for (const { q } of scored) {
    if (selected.length >= DEFAULT_QUESTION_COUNT) break
    if (!seen.has(q.competency_name)) {
      selected.push(q)
      seen.add(q.competency_name)
    }
  }

  for (const { q } of scored) {
    if (selected.length >= DEFAULT_QUESTION_COUNT) break
    if (!selected.includes(q)) selected.push(q)
  }

  return selected.slice(0, DEFAULT_QUESTION_COUNT)
}
