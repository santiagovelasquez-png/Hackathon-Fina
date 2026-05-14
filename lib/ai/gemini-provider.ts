import { GoogleGenerativeAI } from "@google/generative-ai"
import type { AIProvider, SummarizeContext } from "./provider"
import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"
import { AIExtractionOutputSchema } from "@/lib/utl/schema"

const EXTRACTION_MODEL = "gemini-1.5-flash"
const FLASH_MODEL = "gemini-1.5-flash"

const EXTRACTION_SCHEMA_DESC = `Return ONLY a valid JSON object with this exact structure:
{
  "public": {
    "location": { "city": string|null, "country": "ISO-2"|null, "remote": boolean, "timezone": "IANA"|null },
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

const RUBRIC_TEXT = `Fixed rubric:
1-3: No evidence or contradicts the competency
4-6: Partial or generic evidence
7-9: Clear evidence with context
10: Strong evidence with specific measurable example`

function createClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
}

type Part = { text: string } | { inlineData: { data: string; mimeType: string } }

async function runExtraction(parts: Part[]): Promise<AIExtractionOutput> {
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: EXTRACTION_MODEL,
    systemInstruction: `You are an expert CV parser. Extract all structured data from the CV. ${EXTRACTION_SCHEMA_DESC}`,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  })

  const result = await model.generateContent(parts as never)
  const raw = result.response.text()

  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { parsed = {} }

  const check = AIExtractionOutputSchema.safeParse(parsed)
  if (check.success) return check.data

  // Repair pass with Flash
  const flashModel = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: `Fix this JSON to match the schema. ${EXTRACTION_SCHEMA_DESC} Return only valid JSON.`,
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })
  const repair = await flashModel.generateContent([{ text: raw }])

  try {
    const repaired = JSON.parse(repair.response.text())
    const r2 = AIExtractionOutputSchema.safeParse(repaired)
    if (r2.success) return r2.data
  } catch {}

  return AIExtractionOutputSchema.parse({
    public: {
      location: { remote: false },
      experiences: [], education: [], skills: [], languages: [],
      competency_evidence: [], interview_answers: [],
      flags: [{ field: "parse", reason: "Gemini extraction failed after repair pass", severity: "error" }],
    },
    private: {},
  })
}

async function extractUTL(rawText: string): Promise<AIExtractionOutput> {
  return runExtraction([{ text: `Parse this CV:\n\n${rawText.slice(0, 30000)}` }])
}

export async function extractUTLFromPDFBytes(pdfBuffer: Buffer): Promise<AIExtractionOutput> {
  return runExtraction([
    { inlineData: { data: pdfBuffer.toString("base64"), mimeType: "application/pdf" } },
    { text: "Parse this CV and extract all structured data." },
  ])
}

async function evaluateAnswer(params: {
  question: string
  answer: string
  competency_name: string
  rubric: string
}): Promise<Pick<InterviewEvaluation, "proposed_score" | "explanation" | "rubric_applied">> {
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: `You are an interview evaluator scoring answers for the competency "${params.competency_name}".\n${RUBRIC_TEXT}\nReturn ONLY JSON: { "proposed_score": number (1-10), "explanation": string (max 2 sentences), "rubric_applied": string }`,
    generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 512 },
  })

  const result = await model.generateContent(`Question: ${params.question}\n\nAnswer: ${params.answer}`)

  try {
    const raw = JSON.parse(result.response.text())
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
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: "Write a 2-3 sentence professional candidate summary for a recruiter report. Be specific and concise.",
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
  })

  const result = await model.generateContent(
    `Candidate: ${ctx.candidate_title ?? "Unknown"}, ${ctx.total_experience_months}mo experience. Skills: ${ctx.top_skills.join(", ")}. Role: ${ctx.job_title}. Scores: ${ctx.score_breakdown.map((d) => `${d.dimension}=${d.score}`).join(", ")}.`
  )

  return result.response.text().trim() ?? "Candidate profile available for review."
}

export const geminiProvider: AIProvider = { extractUTL, evaluateAnswer, summarize }

export interface ParsedJobProfile {
  title: string
  description: string
  required_skills: Array<{ name: string; required: boolean }>
  competencies: Array<{ name: string; minimum_score: number }>
  min_experience_months: number
}

const JOB_PARSE_SCHEMA = `Return ONLY valid JSON:
{
  "title": string,
  "description": string (2-4 sentences summarizing the role),
  "required_skills": [{ "name": string, "required": boolean }],
  "competencies": [{ "name": string (snake_case, e.g. problem_solving), "minimum_score": number (1-10) }],
  "min_experience_months": number
}`

async function runJobParse(parts: Part[]): Promise<ParsedJobProfile> {
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: `You are an expert HR analyst. Extract a structured job profile from the provided content. ${JOB_PARSE_SCHEMA}`,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1024 },
  })

  const result = await model.generateContent(parts as never)

  try {
    const raw = JSON.parse(result.response.text())
    return {
      title: String(raw.title || "Untitled role"),
      description: String(raw.description || ""),
      required_skills: Array.isArray(raw.required_skills)
        ? raw.required_skills.map((s: { name?: string; required?: boolean }) => ({ name: String(s.name ?? ""), required: Boolean(s.required ?? true) }))
        : [],
      competencies: Array.isArray(raw.competencies)
        ? raw.competencies.map((c: { name?: string; minimum_score?: number }) => ({ name: String(c.name ?? ""), minimum_score: Math.max(1, Math.min(10, Number(c.minimum_score) || 6)) }))
        : [],
      min_experience_months: Math.max(0, Number(raw.min_experience_months) || 0),
    }
  } catch {
    return { title: "", description: "", required_skills: [], competencies: [], min_experience_months: 0 }
  }
}

export async function parseJobProfileFromText(text: string): Promise<ParsedJobProfile> {
  return runJobParse([{ text: `Parse this job description:\n\n${text.slice(0, 20000)}` }])
}

export async function parseJobProfileFromPDF(buffer: Buffer): Promise<ParsedJobProfile> {
  return runJobParse([
    { inlineData: { data: buffer.toString("base64"), mimeType: "application/pdf" } },
    { text: "Extract a structured job profile from this document." },
  ])
}

export async function selectQuestionsWithGemini(
  jobSummary: string,
  questionList: string,
  count: number
): Promise<string[]> {
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: `Select exactly ${count} question IDs most relevant for this job. Ensure variety across competencies. Return ONLY JSON: { "selected_ids": ["id1", "id2", ...] }`,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 200 },
  })

  const result = await model.generateContent(`JOB:\n${jobSummary}\n\nQUESTIONS:\n${questionList}`)
  const raw = JSON.parse(result.response.text())
  return Array.isArray(raw.selected_ids) ? raw.selected_ids : []
}
