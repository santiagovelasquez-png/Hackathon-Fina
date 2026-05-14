import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Briefcase, Plus, ChevronRight, Clock, Users } from "lucide-react"
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

  const statusConfig = (s: string) =>
    s === "active"
      ? { label: "Activo", cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" }
      : s === "closed"
      ? { label: "Cerrado", cls: "bg-red-100 text-red-700 border border-red-200" }
      : { label: "Borrador", cls: "bg-slate-100 text-slate-600 border border-slate-200" }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-4xl flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Cargos</h1>
            <p className="text-sm text-slate-500 mt-0.5">{jobs?.length ?? 0} cargo{jobs?.length !== 1 ? "s" : ""} creado{jobs?.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/jobs/new"
            className="flex items-center gap-2 rounded-xl bg-[#0369A1] text-white px-5 py-2.5 text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 cursor-pointer">
            <Plus size={16} />
            Nuevo cargo
          </Link>
        </div>
      </div>

      <div className="px-8 py-8 max-w-4xl">
        {!jobs || jobs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Briefcase size={28} className="text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Sin cargos todavía</p>
              <p className="text-sm text-slate-500 mt-1">Crea tu primer cargo para empezar a rankear candidatos con IA</p>
            </div>
            <Link href="/jobs/new"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0369A1] text-white px-6 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 cursor-pointer">
              <Plus size={16} /> Crear primer cargo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const profile = job.utl_job_profile as UTLJobProfile
              const skillCount = profile.required_skills?.length ?? 0
              const expMonths = profile.min_experience_months ?? 0
              const expLabel = expMonths >= 12
                ? `${Math.round(expMonths / 12)} año${Math.round(expMonths / 12) !== 1 ? "s" : ""}`
                : expMonths > 0 ? `${expMonths}m` : "Sin mínimo"
              const status = statusConfig(job.status)

              return (
                <Link key={job.id} href={`/ranking/${job.id}`}
                  className="flex items-center gap-4 rounded-2xl bg-white border border-slate-200 px-6 py-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-50 transition-all duration-200 group cursor-pointer">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shrink-0 shadow-md shadow-blue-200">
                    <Briefcase size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{profile.title}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Users size={11} /> {skillCount} skill{skillCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Clock size={11} /> {expLabel}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(job.created_at).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${status.cls}`}>{status.label}</span>
                  <ChevronRight size={16} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
