import type { Question } from "./question-bank"

export type SessionStatus = "pending" | "in_progress" | "completed" | "abandoned"

export interface InterviewState {
  status: SessionStatus
  current_question_index: number
  answers: Record<string, { question_text: string; answer_text: string; answered_at: string }>
  questions: Question[] // selected questions for this session
}

export function getCurrentQuestion(state: InterviewState): Question | null {
  return state.questions[state.current_question_index] ?? null
}

export function isComplete(state: InterviewState): boolean {
  return state.current_question_index >= state.questions.length
}

export function applyAnswer(
  state: InterviewState,
  answer_text: string
): InterviewState {
  const currentQ = getCurrentQuestion(state)
  if (!currentQ) return state

  const newAnswers = {
    ...state.answers,
    [currentQ.id]: {
      question_text: currentQ.question_text,
      answer_text,
      answered_at: new Date().toISOString(),
    },
  }

  const nextIndex = state.current_question_index + 1
  const completed = nextIndex >= state.questions.length

  return {
    ...state,
    answers: newAnswers,
    current_question_index: nextIndex,
    status: completed ? "completed" : "in_progress",
  }
}

export function buildInterviewAnswersForUTL(
  state: InterviewState
): Array<{ question_id: string; question_text: string; answer_text: string; answered_at: string; parsed_into_utl: boolean }> {
  return Object.entries(state.answers).map(([qid, a]) => ({
    question_id: qid,
    question_text: a.question_text,
    answer_text: a.answer_text,
    answered_at: a.answered_at,
    parsed_into_utl: true,
  }))
}
