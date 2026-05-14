import { getAIProvider } from "@/lib/ai"
import type { InterviewEvaluation } from "@/lib/utl/schema"

export const FIXED_RUBRIC = `1-3: No evidence or contradicts the competency
4-6: Partial or generic evidence
7-9: Clear evidence with context and examples
10: Strong evidence with a specific, measurable example`

export async function evaluateInterviewAnswer(params: {
  question_text: string
  answer_text: string
  competency_name: string
  question_id: string
}): Promise<Omit<InterviewEvaluation, "session_id">> {
  const ai = await getAIProvider()

  const { proposed_score, explanation, rubric_applied } = await ai.evaluateAnswer({
    question: params.question_text,
    answer: params.answer_text,
    competency_name: params.competency_name,
    rubric: FIXED_RUBRIC,
  })

  // Engine sets final_score = proposed_score in MVP (no additional adjustment)
  const final_score = proposed_score

  return {
    question_id: params.question_id,
    answer_text: params.answer_text,
    competency_name: params.competency_name,
    proposed_score,
    final_score,
    explanation,
    rubric_applied,
  }
}
