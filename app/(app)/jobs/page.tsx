import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Plus, ChevronRight } from "lucide-react"
import type { UTLJobProfile } from "@/lib/utl/schema"

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()

  const { data: jobs } = membership
    ? await service.from("jobs").select("id, status, created_at, utl_job_profile")
        .eq("company_id", membership.company_id).order("created_at", { ascending: false })
    : { data: [] }

  const statusVariant = (s: string) =>
    s === "active" ? "default" : s === "closed" ? "destructive" : "secondary"
  const statusLabel = (s: string) =>
    s === "active" ? "Activo" : s === "closed" ? "Cerrado" : "Borrador"

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Cargos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{jobs?.length ?? 0} cargo{jobs?.length !== 1 ? "s" : ""} creado{jobs?.length !== 1 ? "s" : ""}</p>
        </div>
        <Link href="/jobs/new"
          className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm">
          <Plus size={16} />
          Nuevo cargo
        </Link>
      </div>

      {!jobs || jobs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Briefcase size={24} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Aún no tienes cargos</p>
            <p className="text-sm text-muted-foreground mt-1">Crea tu primer cargo para empezar a rankear candidatos</p>
          </div>
          <Link href="/jobs/new"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
            <Plus size={16} /> Crear primer cargo
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const profile = job.utl_job_profile as UTLJobProfile
            const skillCount = profile.required_skills?.length ?? 0
            const expYears = Math.round((profile.min_experience_months ?? 0) / 12)
            return (
              <Link key={job.id} href={`/ranking/${job.id}`}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card px-6 py-4 hover:border-primary/30 hover:shadow-sm transition-all group">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Briefcase size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{profile.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {skillCount} skill{skillCount !== 1 ? "s" : ""} · {expYears > 0 ? `${expYears} año${expYears !== 1 ? "s" : ""} exp.` : "Sin mínimo"} ·{" "}
                    {new Date(job.created_at).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge variant={statusVariant(job.status)}>{statusLabel(job.status)}</Badge>
                <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
