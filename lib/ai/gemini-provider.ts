import { GoogleGenerativeAI } from "@google/generative-ai"
import type { AIProvider, SummarizeContext } from "./provider"
import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"
import { AIExtractionOutputSchema } from "@/lib/utl/schema"

const EXTRACTION_MODEL = "gemini-2.5-flash"
const FLASH_MODEL = "gemini-2.5-flash"

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
    systemInstruction: `You are an expert CV parser. Extract ALL structured data from the CV with maximum completeness.

CRITICAL RULES:
- current_title: use the MOST RECENT job title exactly as written
- skills: extract EVERY specific tool, technology, methodology and soft skill mentioned. Include: specific software (n8n, Zapier, Make, ChatGPT, etc.), programming languages, frameworks, methodologies, and ALL soft skills. Do NOT summarize — list each individually
- total_experience_months: sum ALL professional experience, exclude student organizations
- languages: extract ALL languages with exact proficiency levels (native, C1, B2, etc. → map to schema levels)
- experiences: include ALL roles with exact dates; use null for end_date if current
- education: include university degrees AND short courses/certifications
- competency_evidence: extract 3-5 competencies with specific evidence from the CV text
- confidence_score: 0.0-1.0 based on data completeness

${EXTRACTION_SCHEMA_DESC}`,
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

const JOB_PARSE_SCHEMA = `Return ONLY valid JSON with this exact structure:
{
  "title": string (job title, e.g. "Backend Engineer"),
  "description": string (2-4 sentences summarizing the role and responsibilities),
  "required_skills": [{ "name": string, "required": boolean }],
  "competencies": [{ "name": string (snake_case, e.g. "problem_solving"), "minimum_score": number (1-10) }],
  "min_experience_months": number (0 if not specified)
}`

const JOB_PARSE_SYSTEM = `You are an expert HR analyst. Extract a structured job profile from ANY input — formal job descriptions, PDFs, voice transcripts, bullet lists, or informal notes in Spanish or English.

CRITICAL RULES:
- title: infer the most specific job title from the content. NEVER leave empty.
- description: synthesize a clear 2-4 sentence role description. If input is brief, expand sensibly.
- required_skills: extract ALL technologies, tools, frameworks, languages mentioned. Also infer obvious skills from context (e.g. "backend" → add "REST APIs", "databases"). Mark first 3 as required:true.
- competencies: infer 2-4 competencies from the role context. For engineering: problem_solving, collaboration. For leadership: leadership, communication. Etc.
- min_experience_months: if input says "2 años" → 24, "junior" → 6, "senior" → 48, not specified → 0.
- Input may be a voice transcript and sound informal — extract the intent, not the literal words.

${JOB_PARSE_SCHEMA}`

function buildJobProfile(raw: Record<string, unknown>): ParsedJobProfile {
  return {
    title: String(raw.title || "").trim() || "Cargo sin título",
    description: String(raw.description || "").trim(),
    required_skills: Array.isArray(raw.required_skills)
      ? raw.required_skills
          .map((s: { name?: string; required?: boolean }) => ({
            name: String(s.name ?? "").trim(),
            required: Boolean(s.required ?? true),
          }))
          .filter((s) => s.name.length > 0)
      : [],
    competencies: Array.isArray(raw.competencies)
      ? raw.competencies
          .map((c: { name?: string; minimum_score?: number }) => ({
            name: String(c.name ?? "").trim(),
            minimum_score: Math.max(1, Math.min(10, Number(c.minimum_score) || 6)),
          }))
          .filter((c) => c.name.length > 0)
      : [],
    min_experience_months: Math.max(0, Number(raw.min_experience_months) || 0),
  }
}

async function runJobParse(parts: Part[]): Promise<ParsedJobProfile> {
  const genAI = createClient()
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: JOB_PARSE_SYSTEM,
    generationConfig: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 1024 },
  })

  const result = await model.generateContent(parts as never)
  const raw = result.response.text()

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const profile = buildJobProfile(parsed)
    // If title is still placeholder, try repair
    if (profile.title === "Cargo sin título" && raw.length > 10) throw new Error("bad title")
    return profile
  } catch {
    // Repair pass
    try {
      const flashModel = genAI.getGenerativeModel({
        model: FLASH_MODEL,
        systemInstruction: `Fix this JSON to match the schema and fill any missing fields with sensible defaults. ${JOB_PARSE_SCHEMA} Return only valid JSON.`,
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      })
      const repair = await flashModel.generateContent([{ text: raw || "empty" }])
      const repaired = JSON.parse(repair.response.text()) as Record<string, unknown>
      return buildJobProfile(repaired)
    } catch {
      return { title: "Cargo sin título", description: "", required_skills: [], competencies: [], min_experience_months: 0 }
    }
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

export interface GeneratedQuestion {
  id: string
  competency_name: string
  question_text: string
  tags: string[]
}

export async function generateInterviewQuestions(job: {
  title: string
  description: string
  required_skills: Array<{ name: string; required: boolean }>
  competencies: Array<{ name: string; minimum_score: number }>
  min_experience_months: number
}, count = 6): Promise<GeneratedQuestion[]> {
  const genAI = createClient()
  const skillList = job.required_skills.map((s) => `${s.name}${s.required ? " (requerido)" : ""}`).join(", ")
  const compList = job.competencies.map((c) => c.name.replace(/_/g, " ")).join(", ")
  const expYears = job.min_experience_months > 0 ? `${Math.round(job.min_experience_months / 12)} años` : "no especificada"

  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: `You are a senior HR interviewer. Generate ${count} behavioral interview questions SPECIFICALLY tailored to this job.

RULES:
- Each question must relate directly to the role, required skills, or competencies listed
- Questions must be behavioral (STAR format expected): start with "Cuéntame de una vez que..." or "¿Cómo has manejado..." or "Describe una situación donde..."
- Vary across: technical depth, collaboration, delivery, leadership, domain knowledge
- For technical roles: include at least 2 questions about specific technologies listed
- For each competency listed: include at least one question evaluating that competency
- Questions in Spanish. Concise. No preamble.
- Return ONLY valid JSON array:
[{ "id": "custom_1", "competency_name": "snake_case_competency", "question_text": "...", "tags": ["tag1","tag2"] }]`,
    generationConfig: { responseMimeType: "application/json", temperature: 0.4, maxOutputTokens: 2048 },
  })

  const prompt = `CARGO: ${job.title}
DESCRIPCIÓN: ${job.description.slice(0, 400)}
SKILLS REQUERIDAS: ${skillList}
COMPETENCIAS A EVALUAR: ${compList}
EXPERIENCIA MÍNIMA: ${expYears}

Genera ${count} preguntas de entrevista conductual específicas para este cargo.`

  try {
    const result = await model.generateContent(prompt)
    const raw = JSON.parse(result.response.text())
    const questions: GeneratedQuestion[] = Array.isArray(raw) ? raw : []

    const validated = questions
      .filter((q) => q.question_text && q.competency_name)
      .map((q, i) => ({
        id: q.id || `custom_${i + 1}`,
        competency_name: String(q.competency_name).toLowerCase().replace(/\s+/g, "_"),
        question_text: String(q.question_text),
        tags: Array.isArray(q.tags) ? q.tags.map(String) : [],
      }))

    if (validated.length >= count) return validated.slice(0, count)

    // Pad with fallback questions if Gemini returned fewer
    const { QUESTION_BANK } = await import("@/lib/interview/question-bank")
    const needed = count - validated.length
    const usedIds = new Set(validated.map((q) => q.id))
    const fallbacks = QUESTION_BANK.filter((q) => !usedIds.has(q.id)).slice(0, needed)
    return [...validated, ...fallbacks]
  } catch {
    const { QUESTION_BANK } = await import("@/lib/interview/question-bank")
    return QUESTION_BANK.slice(0, count)
  }
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
