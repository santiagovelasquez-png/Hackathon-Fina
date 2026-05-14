import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id: jobId } = await params
  const service = createServiceClient()

  const { data: job } = await service
    .from("jobs")
    .select("id, company_id")
    .eq("id", jobId)
    .single()

  if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 })

  try {
    const { matchTalentsToJob } = await import("@/lib/matching/pipeline")
    await matchTalentsToJob(job.id, job.company_id)
    return NextResponse.json({ ok: true, message: "Matching completed" })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
