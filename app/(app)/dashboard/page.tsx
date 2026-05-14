import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: membership } = await service
    .from("company_members")
    .select("company_id")
    .eq("user_id", user.id)
    .single()

  const companyId = membership?.company_id

  const [{ count: candidateCount }, { count: jobCount }, { count: rankingCount }] =
    await Promise.all([
      service.from("candidates").select("*", { count: "exact", head: true }),
      companyId
        ? service.from("jobs").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active")
        : Promise.resolve({ count: 0 }),
      companyId
        ? service.from("ranking_results").select("*", { count: "exact", head: true }).eq("company_id", companyId)
        : Promise.resolve({ count: 0 }),
    ])

  const stats = [
    { label: "Candidates in pool", value: candidateCount ?? 0 },
    { label: "Active jobs", value: jobCount ?? 0 },
    { label: "Ranked candidates", value: rankingCount ?? 0 },
  ]

  return (
    <div className="p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Welcome back, {user.email}</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border p-6 space-y-1">
            <p className="text-3xl font-bold tabular-nums">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Quick actions</h2>
        <div className="flex gap-3">
          <a href="/upload" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
            Upload a CV
          </a>
          <a href="/jobs/new" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
            Create a job
          </a>
        </div>
      </div>
    </div>
  )
}
