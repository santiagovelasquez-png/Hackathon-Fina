import Groq from "groq-sdk"
import type { AIProvider, SummarizeContext } from "./provider"
import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"
import { AIExtractionOutputSchema } from "@/lib/utl/schema"

const EXTRACTION_MODEL = "llama-3.3-70b-versatile"
const EVALUATION_MODEL = "llama-3.1-8b-instant"

const RUBRIC_TEXT = `Score the answer using this fixed rubric:
1-3: No evidence or contradicts the competency
4-6: Partial or generic evidence
7-9: Clear evidence with context
10: Strong evidence with a specific measurable example`

const EXTRACTION_SCHEMA_DESC = `Return ONLY a valid JSON object with this structure (no markdown, no explanation):
{
  "public": {
    "location": { "city": string|null, "country": "ISO-2-code"|null, "remote": boolean, "timezone": "IANA-tz"|null },
    "total_experience_months": number,
    "current_title": string|null,
    "experiences": [{ "company": string, "title": string, "start_date": "YYYY-MM", "end_date": "YYYY-MM"|null, "duration_months": number, "description": string|null, "sector": string|null }],
    "education": [{ "institution": string, "degree": string|null, "field": string|null, "start_date": "YYYY-MM"|null, "end_date": "YYYY-MM"|null }],
    "skills": [{ "name": string, "category": "technical"|"tool"|"soft"|"domain", "proficiency": "beginner"|"intermediate"|"advanced"|"expert"|null, "years_of_experience": number|null, "source": "declared"|"inferred" }],
    "languages": [{ "code": "ISO-639-1", "proficiency": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"native" }],
    "competency_evidence": [{ "competency_name": string, "evidence_text": string, "evidence_source": "cv_text", "confidence_score": number, "explanation": string, "competency_score": null }],
    "interview_answers": [],
    "confidence_score": number,
    "flags": [{ "field": string, "reason": string, "severity": "warning"|"error" }]
  },
  "private": {
    "full_name": string,
    "email": string|null,
    "phone": string|null,
    "linkedin_url": string|null,
    "portfolio_url": string|null
  }
}`

function createClient(): Groq {
  return new Groq({ apiKey: process.env.GROQ_API_KEY! })
}

async function extractUTL(rawText: string): Promise<AIExtractionOutput> {
  const groq = createClient()

  const completion = await groq.chat.completions.create({
    model: EXTRACTION_MODEL,
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `You are a CV parser. Extract structured data from CVs/resumes. ${EXTRACTION_SCHEMA_DESC}`,
      },
      {
        role: "user",
        content: `Parse this CV and return the JSON:\n\n${rawText.slice(0, 12000)}`,
      },
    ],
    response_format: { type: "json_object" },
  })

  const raw = completion.choices[0]?.message?.content ?? "{}"
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = {}
  }

  const result = AIExtractionOutputSchema.safeParse(parsed)
  if (result.success) return result.data

  // Repair pass — try to coerce partial output
  const repairCompletion = await groq.chat.completions.create({
    model: EXTRACTION_MODEL,
    temperature: 0,
    max_tokens: 4096,
    messages: [
      {
        role: "system",
        content: `Fix this JSON to match the required schema. ${EXTRACTION_SCHEMA_DESC} Return only valid JSON.`,
      },
      { role: "user", content: raw },
    ],
    response_format: { type: "json_object" },
  })

  try {
    const repaired = JSON.parse(repairCompletion.choices[0]?.message?.content ?? "{}")
    const repairResult = AIExtractionOutputSchema.safeParse(repaired)
    if (repairResult.success) return repairResult.data
  } catch {}

  // Return minimal valid structure
  return AIExtractionOutputSchema.parse({
    public: {
      location: { remote: false },
      experiences: [],
      education: [],
      skills: [],
      languages: [],
      competency_evidence: [],
      interview_answers: [],
      flags: [{ field: "parse", reason: "Groq extraction failed after repair pass", severity: "error" }],
    },
    private: {},
  })
}

async function evaluateAnswer(params: {
  question: string
  answer: string
  competency_name: string
  rubric: string
}): Promise<Pick<InterviewEvaluation, "proposed_score" | "explanation" | "rubric_applied">> {
  const groq = createClient()

  const completion = await groq.chat.completions.create({
    model: EVALUATION_MODEL,
    temperature: 0.2,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content: `You are an interview evaluator. Score the answer for the competency "${params.competency_name}".
${RUBRIC_TEXT}
Return ONLY JSON: { "proposed_score": number (1-10), "explanation": string (max 2 sentences), "rubric_applied": string (quote the rubric level applied) }`,
      },
      {
        role: "user",
        content: `Question: ${params.question}\n\nAnswer: ${params.answer}`,
      },
    ],
    response_format: { type: "json_object" },
  })

  try {
    const raw = JSON.parse(completion.choices[0]?.message?.content ?? "{}")
    return {
      proposed_score: Math.max(1, Math.min(10, Number(raw.proposed_score) || 5)),
      explanation: String(raw.explanation || "No explanation provided"),
      rubric_applied: String(raw.rubric_applied || params.rubric),
    }
  } catch {
    return { proposed_score: 5, explanation: "Evaluation unavailable", rubric_applied: params.rubric }
  }
}

async function summarize(ctx: SummarizeContext): Promise<string> {
  const groq = createClient()

  const completion = await groq.chat.completions.create({
    model: EVALUATION_MODEL,
    temperature: 0.4,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content: "Write a 2-3 sentence professional summary of a candidate for a recruiter report. Be specific and concise.",
      },
      {
        role: "user",
        content: `Candidate: ${ctx.candidate_title ?? "Unknown title"}, ${ctx.total_experience_months} months experience. Top skills: ${ctx.top_skills.join(", ")}. Applying to: ${ctx.job_title}. Scores: ${ctx.score_breakdown.map((d) => `${d.dimension}=${d.score}`).join(", ")}.`,
      },
    ],
  })

  return completion.choices[0]?.message?.content?.trim() ?? "Candidate profile available for review."
}

export const groqProvider: AIProvider = { extractUTL, evaluateAnswer, summarize }
