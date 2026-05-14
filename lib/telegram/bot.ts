const BASE = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function call(method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    console.error(`[telegram] ${method} failed:`, text)
  }
}

export async function sendMessage(
  chatId: string | number,
  text: string,
  parseMode: "Markdown" | "HTML" = "Markdown"
): Promise<void> {
  await call("sendMessage", { chat_id: chatId, text, parse_mode: parseMode })
}

export async function sendQuestion(
  chatId: string | number,
  questionText: string,
  index: number,
  total: number
): Promise<void> {
  const text = `📋 *Pregunta ${index + 1} de ${total}*\n\n${questionText}\n\n_Responde con todo el detalle que quieras. No hay respuestas incorrectas._`
  await sendMessage(chatId, text)
}

export async function sendEvalFeedback(
  chatId: string | number,
  score: number,
  explanation: string
): Promise<void> {
  const emoji = score >= 8 ? "🟢" : score >= 5 ? "🟡" : "🔴"
  const text = `${emoji} *Evaluación:* ${explanation}`
  await sendMessage(chatId, text)
}

export async function sendCompletion(
  chatId: string | number,
  name: string,
  jobTitle: string
): Promise<void> {
  const text = `🎉 *¡Entrevista completada, ${name}!*\n\nGracias por completar el proceso para *${jobTitle}*.\n\nEl equipo de reclutamiento revisará tus respuestas y te contactará pronto.\n\n_Powered by OpenScout AI_`
  await sendMessage(chatId, text)
}

export async function sendError(chatId: string | number, msg: string): Promise<void> {
  await sendMessage(chatId, `⚠️ ${msg}`)
}
