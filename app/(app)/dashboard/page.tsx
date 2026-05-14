import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Users, Briefcase, BarChart3, Upload, Plus } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()

  const companyId = membership?.company_id

  const [{ count: candidateCount }, { count: jobCount }, { count: rankingCount }] = await Promise.all([
    service.from("candidates").select("*", { count: "exact", head: true }),
    companyId
      ? service.from("jobs").select("*", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active")
      : Promise.resolve({ count: 0 }),
    companyId
      ? service.from("ranking_results").select("*", { count: "exact", head: true }).eq("company_id", companyId)
      : Promise.resolve({ count: 0 }),
  ])

  const name = user.email?.split("@")[0] ?? "recruiter"

  const stats = [
    { label: "Candidatos en pool", value: candidateCount ?? 0, Icon: Users, color: "bg-blue-500/10 text-blue-600" },
    { label: "Cargos activos", value: jobCount ?? 0, Icon: Briefcase, color: "bg-violet-500/10 text-violet-600" },
    { label: "Candidatos rankeados", value: rankingCount ?? 0, Icon: BarChart3, color: "bg-emerald-500/10 text-emerald-600" },
  ]

  return (
    <div className="p-8 max-w-4xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Hola, {name} 👋</h1>
        <p className="text-muted-foreground mt-1">Aquí tienes un resumen de tu actividad en OpenScout.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-5">
        {stats.map(({ label, value, Icon, color }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-6 flex items-start gap-4 shadow-sm">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-3xl font-bold tabular-nums leading-none">{value}</p>
              <p className="text-sm text-muted-foreground mt-1.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Acciones rápidas</h2>
        <div className="grid grid-cols-2 gap-4">
          <Link href="/upload"
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Upload size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Subir CV</p>
              <p className="text-xs text-muted-foreground mt-0.5">Analiza un candidato con IA</p>
            </div>
          </Link>
          <Link href="/jobs/new"
            className="flex items-center gap-4 rounded-2xl border border-border bg-card p-5 hover:border-primary/40 hover:bg-primary/5 transition-all group shadow-sm">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Plus size={18} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">Crear cargo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Formulario, documento o voz</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
