import { NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const service = createServiceClient()

  // Find talent's candidate profile
  const { data: candidate } = await service
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single()

  if (!candidate) return NextResponse.json({ opportunities: [] })

  const { data: opportunities } = await service
    .from("talent_opportunities")
    .select("id, job_id, company_id, status, score, telegram_url, created_at")
    .eq("candidate_id", candidate.id)
    .order("score", { ascending: false })

  if (!opportunities || opportunities.length === 0) {
    return NextResponse.json({ opportunities: [] })
  }

  // Get job details
  const jobIds = opportunities.map((o) => o.job_id)
  const { data: jobs } = await service
    .from("jobs")
    .select("id, utl_job_profile")
    .in("id", jobIds)

  // Get company names
  const companyIds = [...new Set(opportunities.map((o) => o.company_id))]
  const { data: companies } = await service
    .from("companies")
    .select("id, name")
    .in("id", companyIds)

  const jobMap = new Map(jobs?.map((j) => [j.id, j]) ?? [])
  const companyMap = new Map(companies?.map((c) => [c.id, c]) ?? [])

  const enriched = opportunities.map((opp) => {
    const job = jobMap.get(opp.job_id)
    const company = companyMap.get(opp.company_id)
    const profile = job?.utl_job_profile as { title?: string } | undefined
    return {
      ...opp,
      job_title: profile?.title ?? "Cargo desconocido",
      company_name: company?.name ?? "Empresa",
    }
  })

  return NextResponse.json({ opportunities: enriched })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { opportunity_id, status } = await request.json()
  if (!opportunity_id || !status) return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  const service = createServiceClient()

  // Verify ownership
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
