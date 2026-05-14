import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import QRCode from "qrcode"
import OpportunitiesClient from "./client"

async function generateQR(url: string): Promise<string> {
  try {
    return await QRCode.toDataURL(url, {
      width: 160,
      margin: 1,
      color: { dark: "#4c1d95", light: "#ffffff" },
    })
  } catch {
    return ""
  }
}

export default async function TalentOpportunitiesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: candidate } = await service
    .from("candidates").select("id").eq("user_id", user.id).single()

  const { data: opportunities } = candidate
    ? await service
        .from("talent_opportunities")
        .select("id, job_id, company_id, status, score, telegram_url, created_at")
        .eq("candidate_id", candidate.id)
        .order("score", { ascending: false })
    : { data: [] }

  const jobIds = opportunities?.map((o) => o.job_id) ?? []
  const companyIds = [...new Set(opportunities?.map((o) => o.company_id) ?? [])]

  const [{ data: jobs }, { data: companies }] = await Promise.all([
    jobIds.length > 0
      ? service.from("jobs").select("id, utl_job_profile").in("id", jobIds)
      : Promise.resolve({ data: [] }),
    companyIds.length > 0
      ? service.from("companies").select("id, name, sector").in("id", companyIds)
      : Promise.resolve({ data: [] }),
  ])

  // Pre-generate QR codes server-side
  const qrMap: Record<string, string> = {}
  for (const opp of opportunities ?? []) {
    if (opp.telegram_url && opp.status === "pending") {
      qrMap[opp.id] = await generateQR(opp.telegram_url)
    }
  }

  return (
    <OpportunitiesClient
      candidateId={candidate?.id ?? null}
      initialOpportunities={opportunities ?? []}
      initialJobs={jobs ?? []}
      initialCompanies={companies ?? []}
      qrMap={qrMap}
    />
  )
}
