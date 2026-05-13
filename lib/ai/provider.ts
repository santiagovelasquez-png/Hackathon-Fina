import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"

export interface SummarizeContext {
  candidate_title: string | null
  total_experience_months: number
  top_skills: string[]
  score_breakdown: Array<{ dimension: string; score: number; explanation: string }>
  job_title: string
}

export interface AIProvider {
  /** Extract structured UTL draft from raw CV text. Output must pass Zod validation. */
  extractUTL(rawText: string): Promise<AIExtractionOutput>

  /** Evaluate a single interview answer against a competency rubric. */
  evaluateAnswer(params: {
    question: string
    answer: string
    competency_name: string
    rubric: string
  }): Promise<Pick<InterviewEvaluation, "proposed_score" | "explanation" | "rubric_applied">>

  /** Generate a narrative summary for the report conclusion section. */
  summarize(ctx: SummarizeContext): Promise<string>
}
