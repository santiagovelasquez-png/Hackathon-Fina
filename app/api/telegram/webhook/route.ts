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

// Read questions stored on the session when the opportunity was created.
// Falls back to static bank if missing (legacy sessions).
function getSessionQuestions(sessionAnswers: unknown): typeof QUESTION_BANK {
  const stored = (sessionAnswers as Record<string, unknown>)?.__questions__
  if (Array.isArray(stored) && stored.length > 0) {
    return stored as typeof QUESTION_BANK
  }
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

  // Send first question — use job-specific questions stored on session
  const questions = getSessionQuestions(session.answers)
  const firstQ = questions[session.current_question_index] ?? questions[0]
  await sendQuestion(chatId, firstQ.question_text, session.current_question_index, TOTAL_QUESTIONS)
}

// Called when user shares their phone number (contact button).
// Looks up candidate by phone → finds pending session → starts interview.
async function handleContact(chatId: number, phone: string, firstName: string): Promise<void> {
  const service = createServiceClient()

  // Normalize: strip non-digits, compare last 9 digits (avoids country code mismatches)
  const digits = phone.replace(/\D/g, "")
  const tail = digits.slice(-9)

  const { data: rows } = await service
    .from("candidate_private_data")
    .select("candidate_id, full_name, phone")

  if (!rows || rows.length === 0) {
    await sendMessage(chatId, `Hola ${firstName}. No encontré tu perfil. Asegúrate de haber subido tu CV en la plataforma y de usar el link de la oportunidad.`)
    return
  }

  // Find matching candidate by phone tail
  const match = rows.find((r) => {
    const stored = (r.phone ?? "").replace(/\D/g, "")
    return stored.length >= 7 && stored.endsWith(tail)
  })

  if (!match) {
    await sendMessage(chatId, `No encontré tu perfil con ese número. Usa el link directo de tu oportunidad en la plataforma OpenScout AI.`)
    return
  }

  // Find most recent pending session for this candidate
  const { data: session } = await service
    .from("interview_sessions")
    .select("*")
    .eq("candidate_id", match.candidate_id)
    .in("status", ["pending", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    await sendMessage(chatId, `Hola ${match.full_name ?? firstName}! No tienes entrevistas pendientes en este momento. Las oportunidades aparecen en tu dashboard de OpenScout AI.`)
    return
  }

  // Link this chat_id to the session and start
  await service.from("interview_sessions").update({
    telegram_chat_id: String(chatId),
    channel: "telegram",
    ...(session.status === "pending" ? { status: "in_progress", started_at: new Date().toISOString() } : {}),
  }).eq("id", session.id)

  await service.from("talent_opportunities").update({ status: "interviewing" }).eq("session_id", session.id)

  const { data: job } = await service.from("jobs").select("utl_job_profile").eq("id", session.job_id).single()
  const jobTitle = (job?.utl_job_profile as { title?: string })?.title ?? "la posición"

  await sendMessage(
    chatId,
    `¡Hola ${match.full_name ?? firstName}! 👋\n\nTe encontré en la plataforma. Vamos a iniciar tu entrevista para *${jobTitle}*.\n\nTe haré ${TOTAL_QUESTIONS} preguntas. Responde con detalle.\n\n¡Empezamos!`
  )

  const questions = getSessionQuestions(session.answers)
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
    // No session linked to this chat — ask them to use the link or share phone
    await sendMessage(
      chatId,
      "No tengo una entrevista activa para ti.\n\n*Opciones:*\n1️⃣ Abre el link de tu oportunidad en OpenScout AI (recomendado)\n2️⃣ Comparte tu número de teléfono para buscar tu perfil",
      "Markdown"
    )
    // Send contact request keyboard
    await sendContactRequest(chatId)
    return
  }

  if (text.trim().length < 20) {
    await sendMessage(chatId, "📝 Tu respuesta es muy corta. Cuéntame con más detalle, por favor.")
    return
  }

  const questions = getSessionQuestions(session.answers)
  const currentQ = questions[session.current_question_index]
  if (!currentQ) {
    await sendMessage(chatId, "No hay más preguntas. ¡La entrevista ya está completa!")
    return
  }

  // Strip __questions__ from answers before building state (it's a metadata key, not an answer)
  const rawAnswers = (session.answers as Record<string, unknown>) ?? {}
  const { __questions__: _q, ...answerEntries } = rawAnswers

  const state: InterviewState = {
    status: session.status,
    current_question_index: session.current_question_index,
    answers: answerEntries as InterviewState["answers"],
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
    // Preserve __questions__ metadata alongside actual answers
    answers: { __questions__: questions, ...newState.answers },
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

    // Rescore + send top-3 report to recruiter
    const companyId = await rescoreAfterInterview(session.id, session.candidate_id, session.job_id, newState, evidence)
    if (companyId) {
      try {
        const { sendTopCandidatesReport } = await import("@/lib/email/report")
        await sendTopCandidatesReport({ jobId: session.job_id, companyId, jobTitle })
      } catch (e) {
        console.error("[webhook] email report failed:", e)
      }
    }

    await sendCompletion(chatId, name, jobTitle)
  } else {
    const nextQ = questions[newState.current_question_index]
    if (nextQ) {
      await sendQuestion(chatId, nextQ.question_text, newState.current_question_index, TOTAL_QUESTIONS)
    }
  }
}

async function sendContactRequest(chatId: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "Toca el botón para compartir tu número y buscarte en la plataforma:",
      reply_markup: {
        keyboard: [[{ text: "📱 Compartir mi número", request_contact: true }]],
        resize_keyboard: true,
        one_time_keyboard: true,
      },
    }),
  })
}

async function rescoreAfterInterview(
  _sessionId: string,
  candidateId: string,
  jobId: string,
  state: InterviewState,
  lastEvidence: CompetencyEvidence
): Promise<string | null> {
  const service = createServiceClient()
  const [{ data: candidateRow }, { data: jobRow }] = await Promise.all([
    service.from("candidates").select("id, public_utl").eq("id", candidateId).single(),
    service.from("jobs").select("id, company_id, utl_job_profile").eq("id", jobId).single(),
  ])
  if (!candidateRow || !jobRow) return null

  const utlParse = PublicUTLSchema.safeParse(candidateRow.public_utl)
  const jobParse = UTLJobProfileSchema.safeParse(jobRow.utl_job_profile)
  if (!utlParse.success || !jobParse.success) return null

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

  return jobRow.company_id
}

export async function POST(request: NextRequest) {
  // Always return 200 immediately — Telegram retries on non-200
  try {
    const body = await request.json()
    console.log("[telegram/webhook] update:", JSON.stringify(body).slice(0, 300))

    const message = body?.message
    if (!message?.chat?.id) {
      return NextResponse.json({ ok: true })
    }

    const chatId: number = message.chat.id

    // Handle phone number sharing (contact button)
    if (message.contact) {
      const phone: string = message.contact.phone_number ?? ""
      const firstName: string = message.contact.first_name ?? message.from?.first_name ?? "usuario"
      console.log(`[telegram/webhook] contact from chatId=${chatId} phone=${phone}`)
      await handleContact(chatId, phone, firstName)
      return NextResponse.json({ ok: true })
    }

    const text: string = (message.text ?? "").trim()
    if (!text) return NextResponse.json({ ok: true })

    if (text.startsWith("/start")) {
      const token = text.replace("/start", "").trim()
      if (token) {
        console.log(`[telegram/webhook] /start with token, chatId=${chatId}`)
        await handleStart(chatId, token)
      } else {
        await sendMessage(
          chatId,
          "¡Hola! 👋 Para iniciar tu entrevista, abre el *link de la oportunidad* desde tu dashboard en OpenScout AI.\n\nSi no tienes el link, también puedes compartir tu número de teléfono.",
          "Markdown"
        )
        await sendContactRequest(chatId)
      }
    } else if (!text.startsWith("/")) {
      console.log(`[telegram/webhook] answer from chatId=${chatId}, length=${text.length}`)
      await handleAnswer(chatId, text)
    }
  } catch (e) {
    console.error("[telegram/webhook] error:", e)
  }

  return NextResponse.json({ ok: true })
}
