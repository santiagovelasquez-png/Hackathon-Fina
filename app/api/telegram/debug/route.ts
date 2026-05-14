import { NextResponse } from "next/server"

export const runtime = "nodejs"

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not set" }, { status: 500 })
  }

  const [webhookRes, meRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`),
    fetch(`https://api.telegram.org/bot${token}/getMe`),
  ])

  const [webhookData, meData] = await Promise.all([webhookRes.json(), meRes.json()])

  return NextResponse.json({
    bot: meData,
    webhook: webhookData,
    env: {
      has_token: Boolean(token),
      bot_username: process.env.TELEGRAM_BOT_USERNAME ?? "(not set)",
      app_url: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
    },
  })
}
