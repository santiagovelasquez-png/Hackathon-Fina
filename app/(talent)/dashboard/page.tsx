import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, Star, ArrowRight, CheckCircle, Upload } from "lucide-react"

export default async function TalentDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  const { data: candidate } = await service
    .from("candidates")
    .select("id, public_utl, confidence_score")
    .eq("user_id", user.id)
    .single()

  const { data: opportunities } = candidate
    ? await service
        .from("talent_opportunities")
        .select("id, status, score")
        .eq("candidate_id", candidate.id)
    : { data: [] }

  const pendingCount = opportunities?.filter((o) => o.status === "pending").length ?? 0
  const completedCount = opportunities?.filter((o) => o.status === "completed").length ?? 0
  const utl = candidate?.public_utl as { current_title?: string; skills?: unknown[]; total_experience_months?: number } | null

  const name = user.email?.split("@")[0] ?? "profesional"

  return (
    <div className="min-h-full">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#2d1b69] to-[#7c3aed] px-8 pt-10 pb-16">
        <div className="max-w-4xl">
          <p className="text-violet-300 text-sm font-medium mb-1">Bienvenido de vuelta</p>
          <h1 className="text-3xl font-bold text-white tracking-tight">Hola, {name} 👋</h1>
          <p className="text-violet-200/70 mt-2 text-sm">Tu perfil profesional potenciado con IA</p>
        </div>
      </div>

      <div className="px-8 -mt-8 max-w-4xl pb-12 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              label: "Oportunidades activas",
              value: pendingCount,
              Icon: Star,
              gradient: "from-violet-500 to-violet-600",
              shadow: "shadow-violet-100",
              text: "text-violet-600",
            },
            {
              label: "Entrevistas completadas",
              value: completedCount,
              Icon: CheckCircle,
              gradient: "from-emerald-500 to-emerald-600",
              shadow: "shadow-emerald-100",
              text: "text-emerald-600",
            },
            {
              label: "Skills detectadas",
              value: (utl?.skills as unknown[])?.length ?? 0,
              Icon: FileText,
              gradient: "from-blue-500 to-blue-600",
              shadow: "shadow-blue-100",
              text: "text-blue-600",
            },
          ].map(({ label, value, Icon, gradient, shadow, text }) => (
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

        {/* Profile status */}
        {!candidate ? (
          <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/50 p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto">
              <Upload size={28} className="text-violet-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Aún no tienes un perfil</p>
              <p className="text-sm text-slate-500 mt-1">Sube tu CV para que la IA lo analice y te conecte con oportunidades</p>
            </div>
            <Link href="/talent/cv"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-6 py-3 text-sm font-semibold hover:bg-violet-700 transition-colors shadow-md shadow-violet-200 cursor-pointer">
              <Upload size={15} /> Subir mi CV
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Acciones rápidas</h2>
            <div className="grid grid-cols-2 gap-4">
              <Link href="/talent/opportunities"
                className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:border-violet-300 hover:shadow-lg hover:shadow-violet-50 transition-all duration-200 cursor-pointer">
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center shrink-0 group-hover:bg-violet-100 transition-colors">
                  <Star size={18} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Ver oportunidades</p>
                  <p className="text-xs text-slate-500 mt-0.5">{pendingCount} nuevas para ti</p>
                </div>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-violet-500 transition-all" />
              </Link>
              <Link href="/talent/cv"
                className="group flex items-center gap-4 rounded-2xl bg-white border border-slate-200 p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all duration-200 cursor-pointer">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                  <FileText size={18} className="text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 text-sm">Mi perfil</p>
                  <p className="text-xs text-slate-500 mt-0.5">{utl?.current_title ?? "Ver y actualizar CV"}</p>
                </div>
                <ArrowRight size={15} className="text-slate-300 group-hover:text-blue-500 transition-all" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
