import { NextRequest, NextResponse } from "next/server"
import { createClient, createServiceClient } from "@/lib/supabase/server"
import { UTLJobProfileSchema } from "@/lib/utl/schema"
import { z } from "zod"

const CreateJobBody = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  required_skills: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1).optional(),
    required: z.boolean(),
  })).default([]),
  competencies: z.array(z.object({
    name: z.string(),
    weight: z.number().min(0).max(1).optional(),
    minimum_score: z.number().min(1).max(10),
  })).default([]),
  min_experience_months: z.number().int().nonnegative().default(0),
  location: z.object({
    country: z.string().length(2).nullable().default(null),
    remote_ok: z.boolean().default(true),
  }).default({ country: null, remote_ok: true }),
  salary_range: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().length(3),
  }).nullable().default(null),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .single()

  if (!membership) return NextResponse.json({ error: "No company membership" }, { status: 403 })

  let body: z.infer<typeof CreateJobBody>
  try {
    body = CreateJobBody.parse(await request.json())
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: String(err) }, { status: 400 })
  }

  // Auto-assign equal weights if not provided
  const skillCount = body.required_skills.length || 1
  const compCount = body.competencies.length || 1
  const weightedSkills = body.required_skills.map((s) => ({
    ...s,
    weight: s.weight ?? parseFloat((1 / skillCount).toFixed(3)),
  }))
  const weightedComps = body.competencies.map((c) => ({
    ...c,
    weight: c.weight ?? parseFloat((1 / compCount).toFixed(3)),
  }))

  const utlJobProfile = UTLJobProfileSchema.parse({
    ...body,
    required_skills: weightedSkills,
    competencies: weightedComps,
    salary_is_hard_filter: false,
    status: "active",
  })

  const { data: job, error } = await service
    .from("jobs")
    .insert({
      company_id: membership.company_id,
      utl_job_profile: utlJobProfile,
      status: "active",
    })
    .select("id")
    .single()

  if (error || !job) {
    return NextResponse.json({ error: "Failed to create job", details: error?.message }, { status: 500 })
  }

  return NextResponse.json({ job_id: job.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .single()

  if (!membership) return NextResponse.json({ jobs: [] })

  const { data: jobs } = await service
    .from("jobs")
    .select("id, status, created_at, utl_job_profile")
    .eq("company_id", membership.company_id)
    .order("created_at", { ascending: false })

  return NextResponse.json({ jobs: jobs ?? [] })
}
