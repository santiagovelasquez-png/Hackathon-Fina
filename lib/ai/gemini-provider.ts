import { VertexAI } from "@google-cloud/vertexai"
import type { AIProvider, SummarizeContext } from "./provider"
import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"
import { AIExtractionOutputSchema } from "@/lib/utl/schema"

// Gemini 2.5 Pro: complex extraction (UTL from CV text or PDF bytes)
const EXTRACTION_MODEL = "gemini-2.0-flash-001"
const FLASH_MODEL = "gemini-2.0-flash-001"

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
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY!
  const credentials = JSON.parse(
    raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf-8")
  )

  return new VertexAI({
    project: process.env.GOOGLE_CLOUD_PROJECT!,
    location: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
    googleAuthOptions: { credentials },
  })
}

async function runExtraction(parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>): Promise<AIExtractionOutput> {
  const vertex = createClient()
  const model = vertex.getGenerativeModel({
    model: EXTRACTION_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 8192,
    },
  })

  const result = await model.generateContent({
    systemInstruction: `You are an expert CV parser. Extract all structured data from the CV. ${EXTRACTION_SCHEMA_DESC}`,
    contents: [{ role: "user", parts: parts as never }],
  })

  const raw = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    parsed = {}
  }

  const result1 = AIExtractionOutputSchema.safeParse(parsed)
  if (result1.success) return result1.data

  // Repair pass with Flash (cheaper)
  const flashModel = vertex.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0 },
  })
  const repair = await flashModel.generateContent({
    systemInstruction: `Fix this JSON to match the schema. ${EXTRACTION_SCHEMA_DESC} Return only valid JSON.`,
    contents: [{ role: "user", parts: [{ text: raw }] }],
  })

  try {
    const repaired = JSON.parse(
      repair.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
    )
    const r2 = AIExtractionOutputSchema.safeParse(repaired)
    if (r2.success) return r2.data
  } catch {}

  return AIExtractionOutputSchema.parse({
    public: {
      location: { remote: false },
      experiences: [],
      education: [],
      skills: [],
      languages: [],
      competency_evidence: [],
      interview_answers: [],
      flags: [{ field: "parse", reason: "Gemini extraction failed after repair pass", severity: "error" }],
    },
    private: {},
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

async function extractUTL(rawText: string): Promise<AIExtractionOutput> {
  return runExtraction([{ text: `Parse this CV:\n\n${rawText.slice(0, 30000)}` }])
}

// Native PDF extraction — send PDF bytes directly to Gemini 2.5 Pro
// Skips pdf-parse, handles image-based PDFs, understands layout
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
  const vertex = createClient()
  const model = vertex.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2,
      maxOutputTokens: 512,
    },
  })

  const result = await model.generateContent({
    systemInstruction: `You are an interview evaluator scoring answers for the competency "${params.competency_name}".\n${RUBRIC_TEXT}\nReturn ONLY JSON: { "proposed_score": number (1-10), "explanation": string (max 2 sentences), "rubric_applied": string }`,
    contents: [{
      role: "user",
      parts: [{ text: `Question: ${params.question}\n\nAnswer: ${params.answer}` }],
    }],
  })

  try {
    const raw = JSON.parse(
      result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
    )
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
  const vertex = createClient()
  const model = vertex.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
  })

  const result = await model.generateContent({
    systemInstruction: "Write a 2-3 sentence professional candidate summary for a recruiter report. Be specific and concise.",
    contents: [{
      role: "user",
      parts: [{
        text: `Candidate: ${ctx.candidate_title ?? "Unknown"}, ${ctx.total_experience_months}mo experience. Skills: ${ctx.top_skills.join(", ")}. Role: ${ctx.job_title}. Scores: ${ctx.score_breakdown.map((d) => `${d.dimension}=${d.score}`).join(", ")}.`,
      }],
    }],
  })

  return result.response.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    ?? "Candidate profile available for review."
}

export const geminiProvider: AIProvider = { extractUTL, evaluateAnswer, summarize }

// ── Job profile parsing (Flash — from text or PDF) ────────────────────────────

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

async function runJobParse(parts: Array<{ text?: string; inlineData?: { data: string; mimeType: string } }>): Promise<ParsedJobProfile> {
  const vertex = createClient()
  const model = vertex.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1024 },
  })

  const result = await model.generateContent({
    systemInstruction: `You are an expert HR analyst. Extract a structured job profile from the provided content. ${JOB_PARSE_SCHEMA}`,
    contents: [{ role: "user", parts: parts as never }],
  })

  try {
    const raw = JSON.parse(result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}")
    return {
      title: String(raw.title || "Untitled role"),
      description: String(raw.description || ""),
      required_skills: Array.isArray(raw.required_skills) ? raw.required_skills.map((s: { name?: string; required?: boolean }) => ({ name: String(s.name ?? ""), required: Boolean(s.required ?? true) })) : [],
      competencies: Array.isArray(raw.competencies) ? raw.competencies.map((c: { name?: string; minimum_score?: number }) => ({ name: String(c.name ?? ""), minimum_score: Math.max(1, Math.min(10, Number(c.minimum_score) || 6)) })) : [],
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

// ── Question selection (Flash — fast + cheap) ─────────────────────────────────

export async function selectQuestionsWithGemini(
  jobSummary: string,
  questionList: string,
  count: number
): Promise<string[]> {
  const vertex = createClient()
  const model = vertex.getGenerativeModel({
    model: FLASH_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
      maxOutputTokens: 200,
    },
  })

  const result = await model.generateContent({
    systemInstruction: `Select exactly ${count} question IDs most relevant for this job. Ensure variety across competencies. Return ONLY JSON: { "selected_ids": ["id1", "id2", ...] }`,
    contents: [{
      role: "user",
      parts: [{ text: `JOB:\n${jobSummary}\n\nQUESTIONS:\n${questionList}` }],
    }],
  })

  const raw = JSON.parse(
    result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}"
  )
  return Array.isArray(raw.selected_ids) ? raw.selected_ids : []
}
