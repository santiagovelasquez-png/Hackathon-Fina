import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Users, Briefcase, BarChart3, Upload, Plus, ArrowRight } from "lucide-react"

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
    {
      label: "Candidatos en pool",
      value: candidateCount ?? 0,
      Icon: Users,
      gradient: "from-blue-500 to-blue-600",
      bg: "bg-blue-50",
      text: "text-blue-600",
      shadow: "shadow-blue-100",
    },
    {
      label: "Cargos activos",
      value: jobCount ?? 0,
      Icon: Briefcase,
      gradient: "from-violet-500 to-violet-600",
      bg: "bg-violet-50",
      text: "text-violet-600",
      shadow: "shadow-violet-100",
    },
    {
      label: "Candidatos rankeados",
      value: rankingCount ?? 0,
      Icon: BarChart3,
      gradient: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      shadow: "shadow-emerald-100",
    },
  ]

  return (
    <div className="min-h-full">
      {/* Hero gradient header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1e3a5f] to-[#0369A1] px-8 pt-10 pb-16">
        <div className="max-w-4xl">
          <p className="text-blue-300 text-sm font-medium mb-1">Bienvenido de vuelta</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hola, {name} 👋</h1>
          <p className="text-blue-200/70 mt-2 text-sm">Tu plataforma de reclutamiento potenciada con IA</p>
        </div>
      </div>

      <div className="px-8 -mt-8 max-w-4xl pb-12 space-y-8">
        {/* Stat cards — glass floating over gradient */}
        <div className="grid grid-cols-3 gap-5">
          {stats.map(({ label, value, Icon, gradient, bg, text, shadow }) => (
            <div key={label}
              className={`rounded-2xl bg-white/90 backdrop-blur-md border border-white/60 p-6 shadow-xl ${shadow} flex items-center gap-4`}>
              <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0 shadow-lg`}>
                <Icon size={22} className="text-white" />
              </div>
              <div>
                <p className="text-4xl font-bold tabular-nums text-slate-900 leading-none">{value}</p>
                <p className={`text-xs font-medium mt-1.5 ${text}`}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Acciones rápidas</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link href="/upload"
              className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all duration-200 cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                <Upload size={18} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">Subir CV</p>
                <p className="text-xs text-slate-500 mt-0.5">Analiza un candidato con IA</p>
              </div>
              <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
            <Link href="/jobs/new"
              className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-50 transition-all duration-200 cursor-pointer">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                <Plus size={18} className="text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 text-sm">Crear cargo</p>
                <p className="text-xs text-slate-500 mt-0.5">Formulario, documento o voz</p>
              </div>
              <ArrowRight size={15} className="text-slate-300 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>

        {/* Getting started tip if no data */}
        {(candidateCount ?? 0) === 0 && (jobCount ?? 0) === 0 && (
          <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-violet-50 border border-blue-100 p-6">
            <p className="font-semibold text-slate-800 text-sm">¿Por dónde empezar?</p>
            <ol className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">1</span> Crea un cargo con el perfil que buscas</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">2</span> Sube CVs de candidatos (PDF)</li>
              <li className="flex items-start gap-2"><span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">3</span> Invita a entrevistas desde el ranking</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  )
}
