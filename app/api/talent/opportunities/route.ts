import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import QRCode from "qrcode"

export const runtime = "nodejs"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const service = createServiceClient()

  // Support candidate_id from query param (client polling) or auto-lookup
  let candidateId = request.nextUrl.searchParams.get("candidate_id")
  if (!candidateId) {
    const { data: candidate } = await service
      .from("candidates").select("id").eq("user_id", user.id).single()
    candidateId = candidate?.id ?? null
  }

  if (!candidateId) return NextResponse.json({ opportunities: [], jobs: [], companies: [], qr_map: {} })

  const { data: opportunities } = await service
    .from("talent_opportunities")
    .select("id, job_id, company_id, status, score, telegram_url, created_at")
    .eq("candidate_id", candidateId)
    .order("score", { ascending: false })

  if (!opportunities || opportunities.length === 0) {
    return NextResponse.json({ opportunities: [], jobs: [], companies: [], qr_map: {} })
  }

  const jobIds = opportunities.map((o) => o.job_id)
  const companyIds = [...new Set(opportunities.map((o) => o.company_id))]

  const [{ data: jobs }, { data: companies }] = await Promise.all([
    service.from("jobs").select("id, utl_job_profile").in("id", jobIds),
    service.from("companies").select("id, name, sector").in("id", companyIds),
  ])

  const qr_map: Record<string, string> = {}
  for (const opp of opportunities) {
    if (opp.telegram_url && opp.status === "pending") {
      try {
        qr_map[opp.id] = await QRCode.toDataURL(opp.telegram_url, {
          width: 160, margin: 1,
          color: { dark: "#4c1d95", light: "#ffffff" },
        })
      } catch { /* skip */ }
    }
  }

  return NextResponse.json({ opportunities, jobs: jobs ?? [], companies: companies ?? [], qr_map })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { opportunity_id, status } = await request.json()
  if (!opportunity_id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const service = createServiceClient()

  const { data: candidate } = await service
    .from("candidates").select("id").eq("user_id", user.id).single()
  if (!candidate) return NextResponse.json({ error: "No candidate profile" }, { status: 403 })

  await service
    .from("talent_opportunities")
    .update({ status })
    .eq("id", opportunity_id)
    .eq("candidate_id", candidate.id)

  return NextResponse.json({ ok: true })
}
