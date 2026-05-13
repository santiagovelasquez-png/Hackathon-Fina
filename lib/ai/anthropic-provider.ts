import Anthropic from "@anthropic-ai/sdk"
import { type AIExtractionOutput, type InterviewEvaluation } from "@/lib/utl/schema"
import { validateAIExtractionOutput } from "@/lib/utl/validator"
import type { AIProvider, SummarizeContext } from "./provider"

const client = new Anthropic()

const EXTRACT_SYSTEM_PROMPT = `You are a structured data extractor for a talent scouting platform.
Extract candidate information from the provided CV text and return a JSON object with EXACTLY this structure:

{
  "public": {
    "location": { "city": string|null, "country": "XX" (ISO 3166-1 alpha-2)|null, "remote": boolean, "timezone": string|null },
    "total_experience_months": number (integer, computed from experiences),
    "current_title": string|null,
    "experiences": [{ "company": string, "title": string, "start_date": "YYYY-MM", "end_date": "YYYY-MM"|null, "duration_months": number, "description": string|null, "sector": string|null }],
    "education": [{ "institution": string, "degree": string|null, "field": string|null, "start_date": "YYYY-MM"|null, "end_date": "YYYY-MM"|null }],
    "skills": [{ "name": string, "category": "technical"|"tool"|"soft"|"domain", "proficiency": "beginner"|"intermediate"|"advanced"|"expert"|null, "years_of_experience": number|null, "source": "declared"|"inferred" }],
    "languages": [{ "code": "xx" (ISO 639-1 2 letters), "proficiency": "A1"|"A2"|"B1"|"B2"|"C1"|"C2"|"native" }],
    "competency_evidence": [{ "competency_name": string, "evidence_text": string (exact quote), "evidence_source": "cv_text"|"interview_answer"|"linkedin", "confidence_score": 0-1, "explanation": string, "competency_score": null }],
    "interview_answers": [],
    "confidence_score": 0-1 (how complete the extraction is),
    "flags": [{ "field": string, "reason": string, "severity": "warning"|"error" }]
  },
  "private": {
    "full_name": string|null,
    "email": string|null,
    "phone": string|null,
    "linkedin_url": string|null,
    "portfolio_url": string|null
  }
}

RULES:
- Never invent information not present in the text
- competency_score must ALWAYS be null (scoring engine sets this, not you)
- Use null for missing optional fields, empty arrays for missing arrays
- Dates must be YYYY-MM format
- If you cannot determine a field, use null rather than guessing`

export const anthropicProvider: AIProvider = {
  async extractUTL(rawText: string): Promise<AIExtractionOutput> {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: EXTRACT_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Extract the candidate information from this CV:\n\n${rawText}`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Unexpected response type from Anthropic")

    // Extract JSON from response (may be wrapped in ```json blocks)
    const jsonMatch = content.text.match(/```json\s*([\s\S]+?)\s*```/) ??
                      content.text.match(/(\{[\s\S]+\})/)
    if (!jsonMatch) throw new Error("No JSON found in AI response")

    const parsed = JSON.parse(jsonMatch[1])
    const validation = validateAIExtractionOutput(parsed)

    if (!validation.success) {
      // Attempt repair pass
      const repairResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        system: EXTRACT_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Extract the candidate information from this CV:\n\n${rawText}`,
          },
          { role: "assistant", content: content.text },
          {
            role: "user",
            content: `The JSON you returned has validation errors. Fix them and return only valid JSON:\n${validation.errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")}`,
          },
        ],
      })

      const repairContent = repairResponse.content[0]
      if (repairContent.type !== "text") throw new Error("Repair response not text")

      const repairJson = repairContent.text.match(/```json\s*([\s\S]+?)\s*```/) ??
                         repairContent.text.match(/(\{[\s\S]+\})/)
      if (!repairJson) throw new Error("No JSON in repair response")

      const repairParsed = JSON.parse(repairJson[1])
      const repairValidation = validateAIExtractionOutput(repairParsed)
      if (!repairValidation.success) {
        throw new Error(
          `AI extraction failed validation after repair: ${repairValidation.errors.map((e) => e.message).join(", ")}`
        )
      }
      return repairValidation.data
    }

    return validation.data
  },

  async evaluateAnswer({ question, answer, competency_name, rubric }): Promise<
    Pick<InterviewEvaluation, "proposed_score" | "explanation" | "rubric_applied">
  > {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 512,
      temperature: 0.2, // Low temperature for consistent rubric application
      system: `You evaluate interview answers using a fixed rubric. Return only valid JSON with keys: proposed_score (integer 1-10), explanation (string).

RUBRIC FOR ALL COMPETENCIES:
${rubric}

Be strict. Base score only on evidence quality in the answer.`,
      messages: [
        {
          role: "user",
          content: `Competency: ${competency_name}\nQuestion: ${question}\nAnswer: ${answer}\n\nReturn JSON: { "proposed_score": <1-10>, "explanation": "<why this score>" }`,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== "text") throw new Error("Unexpected response type")

    const jsonMatch = content.text.match(/\{[\s\S]+\}/)
    if (!jsonMatch) throw new Error("No JSON in evaluation response")

    const parsed = JSON.parse(jsonMatch[0])
    const score = Math.min(10, Math.max(1, Math.round(Number(parsed.proposed_score))))

    return {
      proposed_score: score,
      explanation: String(parsed.explanation),
      rubric_applied: rubric,
    }
  },

  async summarize(ctx: SummarizeContext): Promise<string> {
    const { candidate_title, total_experience_months, top_skills, score_breakdown, job_title } = ctx
    const years = Math.floor(total_experience_months / 12)

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      system: "Write a concise 2-3 sentence professional summary for a talent scouting report. Be specific, evidence-based, and objective. No fluff.",
      messages: [
        {
          role: "user",
          content: `Candidate: ${candidate_title ?? "Professional"}, ${years} years experience
Top skills: ${top_skills.join(", ")}
Job: ${job_title}
Score breakdown: ${score_breakdown.map((d) => `${d.dimension}: ${d.score}/10 — ${d.explanation}`).join("; ")}`,
        },
      ],
    })

    const content = response.content[0]
    return content.type === "text" ? content.text : ""
  },
}
