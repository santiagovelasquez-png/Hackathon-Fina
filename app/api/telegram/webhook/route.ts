import { NextRequest, NextResponse } from "next/server"
import { createHash } from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { sendMessage, sendQuestion, sendEvalFeedback, sendCompletion, sendError } from "@/lib/telegram/bot"
import { evaluateInterviewAnswer } from "@/lib/interview/rubric"
import { parseAnswerToEvidence } from "@/lib/interview/answer-parser"
import { applyAnswer, buildInterviewAnswersForUTL, type InterviewState } from "@/lib/interview/flow"
import { computeScore } from "@/lib/scoring/engine"
import { PublicUTLSchema, UTLJobProfileSchema } from "@/lib/utl/schema"
import { QUESTION_BANK } from "@/lib/interview/question-bank"
import type { CompetencyEvidence } from "@/lib/utl/schema"

export const runtime = "nodejs"
export const maxDuration = 60

const TOTAL_QUESTIONS = 6

function verifyToken(received: string, stored: string, expiresAt: string): boolean {
  if (new Date(expiresAt) < new Date()) return false
  const hash = createHash("sha256").update(received).digest("hex")
  return hash === stored
}

function getQuestions() {
  return QUESTION_BANK.slice(0, TOTAL_QUESTIONS)
}

async function handleStart(chatId: number, token: string): Promise<void> {
  const service = createServiceClient()

  const { data: session } = await service
    .from("interview_sessions")
    .select("*")
    .eq("access_token_hash", createHash("sha256").update(token).digest("hex"))
    .single()

  if (!session) {
    await sendError(chatId, "Link inválido o expirado. Solicita un nuevo link de entrevista.")
    return
  }

  if (!verifyToken(token, session.access_token_hash, session.expires_at)) {
    await sendError(chatId, "Este link ha expirado. Solicita un nuevo link de entrevista.")
    return
  }

  if (session.status === "completed") {
    await sendMessage(chatId, "✅ Ya completaste esta entrevista. ¡Gracias!")
    return
  }

  // Store chat_id on session
  await service.from("interview_sessions").update({
    telegram_chat_id: String(chatId),
    channel: "telegram",
    ...(session.status === "pending" ? { status: "in_progress", started_at: new Date().toISOString() } : {}),
  }).eq("id", session.id)

  // Update opportunity status
  await service.from("talent_opportunities").update({ status: "interviewing" })
    .eq("session_id", session.id)

  // Get candidate name
  const { data: privateData } = await service
    .from("candidate_private_data")
    .select("full_name")
    .eq("candidate_id", session.candidate_id)
    .single()

  const name = privateData?.full_name ?? "profesional"

  // Get job title
  const { data: job } = await service
    .from("jobs").select("utl_job_profile").eq("id", session.job_id).single()
  const jobTitle = (job?.utl_job_profile as { title?: string })?.title ?? "la posición"

  await sendMessage(
    chatId,
    `¡Hola ${name}! 👋\n\nTe damos la bienvenida a la entrevista para *${jobTitle}*.\n\nVamos a hacerte ${TOTAL_QUESTIONS} preguntas. Responde con tranquilidad y con todo el detalle que necesites. No hay respuestas incorrectas.\n\n¡Empezamos!`
  )

  // Send first question
  const questions = getQuestions()
  const firstQ = questions[session.current_question_index] ?? questions[0]
  await sendQuestion(chatId, firstQ.question_text, session.current_question_index, TOTAL_QUESTIONS)
}

async function handleAnswer(chatId: number, text: string): Promise<void> {
  const service = createServiceClient()

  const { data: session } = await service
    .from("interview_sessions")
    .select("*")
    .eq("telegram_chat_id", String(chatId))
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    await sendMessage(chatId, "No tengo una entrevista activa para ti. Si crees que es un error, abre tu link de entrevista nuevamente.")
    return
  }

  if (text.trim().length < 20) {
    await sendMessage(chatId, "📝 Tu respuesta es muy corta. Cuéntame con más detalle, por favor.")
    return
  }

  const questions = getQuestions()
  const currentQ = questions[session.current_question_index]
  if (!currentQ) {
    await sendMessage(chatId, "No hay más preguntas. ¡La entrevista ya está completa!")
    return
  }

  const state: InterviewState = {
    status: session.status,
    current_question_index: session.current_question_index,
    answers: (session.answers as InterviewState["answers"]) ?? {},
    questions,
  }

  const newState = applyAnswer(state, text)

  const [evaluation, evidence] = await Promise.all([
    evaluateInterviewAnswer({
      question_text: currentQ.question_text,
      answer_text: text,
      competency_name: currentQ.competency_name,
      question_id: currentQ.id,
    }),
    parseAnswerToEvidence({
      question_text: currentQ.question_text,
      answer_text: text,
      competency_name: currentQ.competency_name,
    }),
  ])

  await service.from("interview_evaluations").insert({
    session_id: session.id,
    question_id: currentQ.id,
    answer_text: text,
    competency_name: currentQ.competency_name,
    proposed_score: evaluation.proposed_score,
    final_score: evaluation.final_score,
    explanation: evaluation.explanation,
    rubric_applied: evaluation.rubric_applied,
  })

  await service.from("interview_sessions").update({
    status: newState.status,
    current_question_index: newState.current_question_index,
    answers: newState.answers,
    ...(newState.status === "completed" ? { completed_at: new Date().toISOString() } : {}),
  }).eq("id", session.id)

  // Send feedback
  await sendEvalFeedback(chatId, evaluation.proposed_score, evaluation.explanation)

  if (newState.status === "completed") {
    // Get candidate name + job title for completion message
    const [{ data: privateData }, { data: job }] = await Promise.all([
      service.from("candidate_private_data").select("full_name").eq("candidate_id", session.candidate_id).single(),
      service.from("jobs").select("utl_job_profile").eq("id", session.job_id).single(),
    ])
    const name = privateData?.full_name ?? "profesional"
    const jobTitle = (job?.utl_job_profile as { title?: string })?.title ?? "la posición"

    // Update opportunity to completed
    await service.from("talent_opportunities").update({ status: "completed" }).eq("session_id", session.id)

    // Rescore
    await rescoreAfterInterview(session.id, session.candidate_id, session.job_id, newState, evidence)

    await sendCompletion(chatId, name, jobTitle)
  } else {
    const nextQ = questions[newState.current_question_index]
    if (nextQ) {
      await sendQuestion(chatId, nextQ.question_text, newState.current_question_index, TOTAL_QUESTIONS)
    }
  }
}

async function rescoreAfterInterview(
  _sessionId: string,
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

  const interviewAnswers = buildInterviewAnswersForUTL(state)
  const updatedUTL = {
    ...utlParse.data,
    interview_answers: interviewAnswers,
    competency_evidence: [...utlParse.data.competency_evidence, lastEvidence],
  }

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
    service.from("candidates").update({ public_utl: updatedUTL }).eq("id", candidateId),
    service.from("candidate_scores").upsert({
      candidate_id: candidateId,
      job_id: jobId,
      total_score: score.total_score,
      breakdown: score.breakdown,
      exclusion_reason: score.exclusion_reason,
      engine_version: score.engine_version,
      computed_at: score.computed_at,
    }, { onConflict: "candidate_id,job_id" }),
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

export async function POST(request: NextRequest) {
  // Always return 200 immediately — Telegram retries on non-200
  try {
    const body = await request.json()
    const message = body?.message
    if (!message?.text || !message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId: number = message.chat.id
    const text: string = message.text.trim()

    if (text.startsWith("/start")) {
      const token = text.replace("/start", "").trim()
      if (token) {
        await handleStart(chatId, token)
      } else {
        await sendMessage(chatId, "Hola 👋 Para iniciar tu entrevista, abre el link que te enviaron.")
      }
    } else if (!text.startsWith("/")) {
      await handleAnswer(chatId, text)
    }
  } catch (e) {
    console.error("[telegram/webhook] error:", e)
  }

  return NextResponse.json({ ok: true })
}
