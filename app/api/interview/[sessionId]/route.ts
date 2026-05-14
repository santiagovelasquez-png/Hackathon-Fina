import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { createHash } from "crypto"
import { applyAnswer, buildInterviewAnswersForUTL, type InterviewState } from "@/lib/interview/flow"
import { evaluateInterviewAnswer } from "@/lib/interview/rubric"
import { parseAnswerToEvidence } from "@/lib/interview/answer-parser"
import { computeScore } from "@/lib/scoring/engine"
import { PublicUTLSchema, UTLJobProfileSchema } from "@/lib/utl/schema"
import { QUESTION_BANK } from "@/lib/interview/question-bank"
import type { Question } from "@/lib/interview/question-bank"
import type { CompetencyEvidence } from "@/lib/utl/schema"

export const runtime = "nodejs"
export const maxDuration = 60

function verifyToken(received: string | null, stored: string, expiresAt: string): boolean {
  if (!received) return false
  if (new Date(expiresAt) < new Date()) return false
  const hash = createHash("sha256").update(received).digest("hex")
  return hash === stored
}

async function getSession(sessionId: string) {
  const service = createServiceClient()
  return service
    .from("interview_sessions")
    .select("*")
    .eq("id", sessionId)
    .single()
}

function getSessionQuestions(session: Record<string, unknown>): Question[] {
  // Questions stored in the session or fallback to full bank
  const storedAnswers = session.answers as Record<string, unknown> ?? {}
  const answeredIds = Object.keys(storedAnswers)

  // Try to recover selected questions from normalized_inputs (stored at creation)
  // Fallback: use first 6 from bank
  return QUESTION_BANK.slice(0, 6)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const token = request.nextUrl.searchParams.get("token")

  const service = createServiceClient()
  const { data: session, error } = await getSession(sessionId)

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!verifyToken(token, session.access_token_hash, session.expires_at)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  const { data: job } = await service
    .from("jobs").select("utl_job_profile").eq("id", session.job_id).single()

  const questions = getSessionQuestions(session)
  const currentQ = questions[session.current_question_index] ?? null

  return NextResponse.json({
    status: session.status,
    current_question_index: session.current_question_index,
    total_questions: questions.length,
    current_question: currentQ
      ? { id: currentQ.id, text: currentQ.question_text, competency: currentQ.competency_name }
      : null,
    job_title: (job?.utl_job_profile as { title?: string })?.title ?? "Interview",
    completed: session.status === "completed",
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const token = request.nextUrl.searchParams.get("token")

  const service = createServiceClient()
  const { data: session, error } = await getSession(sessionId)

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 })
  }

  if (!verifyToken(token, session.access_token_hash, session.expires_at)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  if (session.status === "completed") {
    return NextResponse.json({ error: "Session already completed" }, { status: 409 })
  }

  let body: { answer_text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  if (!body.answer_text?.trim()) {
    return NextResponse.json({ error: "answer_text required" }, { status: 400 })
  }

  const questions = getSessionQuestions(session)
  const currentQ = questions[session.current_question_index]
  if (!currentQ) {
    return NextResponse.json({ error: "No current question" }, { status: 400 })
  }

  // Build state from DB session
  const state: InterviewState = {
    status: session.status,
    current_question_index: session.current_question_index,
    answers: (session.answers as InterviewState["answers"]) ?? {},
    questions,
  }

  // Apply answer to state
  const newState = applyAnswer(state, body.answer_text)

  // Evaluate answer with AI (async, best-effort)
  const [evaluation, evidence] = await Promise.all([
    evaluateInterviewAnswer({
      question_text: currentQ.question_text,
      answer_text: body.answer_text,
      competency_name: currentQ.competency_name,
      question_id: currentQ.id,
    }),
    parseAnswerToEvidence({
      question_text: currentQ.question_text,
      answer_text: body.answer_text,
      competency_name: currentQ.competency_name,
    }),
  ])

  // Persist evaluation
  await service.from("interview_evaluations").insert({
    session_id: sessionId,
    question_id: currentQ.id,
    answer_text: body.answer_text,
    competency_name: currentQ.competency_name,
    proposed_score: evaluation.proposed_score,
    final_score: evaluation.final_score,
    explanation: evaluation.explanation,
    rubric_applied: evaluation.rubric_applied,
  })

  // Update session
  await service.from("interview_sessions").update({
    status: newState.status,
    current_question_index: newState.current_question_index,
    answers: newState.answers,
    ...(newState.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
    ...(newState.current_question_index === 1 ? { started_at: new Date().toISOString() } : {}),
  }).eq("id", sessionId)

  // If completed: fold interview answers into UTL and re-score
  if (newState.status === "completed") {
    await rescoreAfterInterview(sessionId, session.candidate_id, session.job_id, newState, evidence)
  }

  const nextQ = questions[newState.current_question_index] ?? null

  return NextResponse.json({
    status: newState.status,
    current_question_index: newState.current_question_index,
    total_questions: questions.length,
    next_question: nextQ
      ? { id: nextQ.id, text: nextQ.question_text, competency: nextQ.competency_name }
      : null,
    evaluation: { score: evaluation.proposed_score, explanation: evaluation.explanation },
    completed: newState.status === "completed",
  })
}

async function rescoreAfterInterview(
  sessionId: string,
  candidateId: string,
  jobId: string,
  state: InterviewState,
  lastEvidence: CompetencyEvidence
) {
  const service = createServiceClient()

  const [{ data: candidateRow }, { data: jobRow }] = await Promise.all([
    service.from("candidates").select("id, public_utl").eq("id", candidateId).single(),
    service.from("jobs").select("id, company_id, utl_job_profile").eq("id", jobId).single(),
  ])

  if (!candidateRow || !jobRow) return

  const utlParse = PublicUTLSchema.safeParse(candidateRow.public_utl)
  const jobParse = UTLJobProfileSchema.safeParse(jobRow.utl_job_profile)
  if (!utlParse.success || !jobParse.success) return

  // Fold interview answers into UTL
  const interviewAnswers = buildInterviewAnswersForUTL(state)
  const updatedUTL = {
    ...utlParse.data,
    interview_answers: interviewAnswers,
    competency_evidence: [...utlParse.data.competency_evidence, lastEvidence],
  }

  // Re-score with updated UTL
  const score = computeScore(updatedUTL, jobParse.data)

  const profileSummary = {
    current_title: updatedUTL.current_title,
    total_experience_months: updatedUTL.total_experience_months,
    top_skills: updatedUTL.skills.slice(0, 5).map((s) => s.name),
    location_summary: [updatedUTL.location.city, updatedUTL.location.country].filter(Boolean).join(" · ") || null,
    languages: updatedUTL.languages.map((l) => l.code.toUpperCase()),
    confidence_score: updatedUTL.confidence_score,
  }

  await Promise.all([
    // Update candidate's UTL with interview answers
    service.from("candidates").update({ public_utl: updatedUTL }).eq("id", candidateId),
    // Upsert candidate_scores
    service.from("candidate_scores").upsert({
      candidate_id: candidateId,
      job_id: jobId,
      total_score: score.total_score,
      breakdown: score.breakdown,
      exclusion_reason: score.exclusion_reason,
      engine_version: score.engine_version,
      computed_at: score.computed_at,
    }, { onConflict: "candidate_id,job_id" }),
    // Update ranking_results
    service.from("ranking_results").upsert({
      company_id: jobRow.company_id,
      job_id: jobId,
      candidate_id: candidateId,
      score_snapshot: score.total_score,
      profile_summary: profileSummary,
      pii_unlocked: false,
    }, { onConflict: "job_id,candidate_id" }),
  ])
}
