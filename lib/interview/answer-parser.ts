import { getAIProvider } from "@/lib/ai"
import type { CompetencyEvidence } from "@/lib/utl/schema"
import { FIXED_RUBRIC } from "./rubric"

export async function parseAnswerToEvidence(params: {
  question_text: string
  answer_text: string
  competency_name: string
}): Promise<CompetencyEvidence> {
  const ai = await getAIProvider()

  const { proposed_score, explanation } = await ai.evaluateAnswer({
    question: params.question_text,
    answer: params.answer_text,
    competency_name: params.competency_name,
    rubric: FIXED_RUBRIC,
  })

  return {
    competency_name: params.competency_name,
    evidence_text: params.answer_text.slice(0, 500),
    evidence_source: "interview_answer",
    confidence_score: proposed_score / 10,
    explanation,
    competency_score: null, // set by scoring engine
  }
}
