import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Star, MessageCircle, CheckCircle, Clock } from "lucide-react"

function StatusBadge({ status }: { status: string }) {
  if (status === "completed")
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200"><CheckCircle size={11} /> Completado</span>
  if (status === "interviewing")
    return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200"><MessageCircle size={11} /> En proceso</span>
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-100 text-violet-700 border border-violet-200"><Clock size={11} /> Pendiente</span>
}

function ScorePill({ score }: { score: number }) {
  const cfg = score >= 8
    ? "bg-emerald-100 text-emerald-700 border-emerald-200"
    : score >= 6
    ? "bg-blue-100 text-blue-700 border-blue-200"
    : "bg-amber-100 text-amber-700 border-amber-200"
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {Number(score).toFixed(1)} match
    </span>
  )
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

  const jobMap = new Map(jobs?.map((j) => [j.id, j]) ?? [])
  const companyMap = new Map(companies?.map((c) => [c.id, c]) ?? [])

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold text-slate-900">Oportunidades</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            La IA seleccionó estas posiciones para tu perfil. Solo aparecen las que mejor coinciden contigo.
          </p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-4xl">
        {!opportunities || opportunities.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Star size={28} className="text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Sin oportunidades por ahora</p>
              <p className="text-sm text-slate-500 mt-1">
                {!candidate
                  ? "Primero sube tu CV para que la IA busque oportunidades para ti."
                  : "La IA está buscando posiciones que coincidan con tu perfil. Vuelve pronto."}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {opportunities.map((opp) => {
              const job = jobMap.get(opp.job_id)
              const company = companyMap.get(opp.company_id)
              const profile = job?.utl_job_profile as { title?: string; min_experience_months?: number; location?: { remote_ok?: boolean } } | undefined
              const canInterview = opp.status === "pending" && opp.telegram_url

              return (
                <div key={opp.id}
                  className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-violet-200 hover:shadow-lg hover:shadow-violet-50 transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
                          <Star size={16} className="text-white" fill="white" />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{profile?.title ?? "Cargo"}</p>
                          <p className="text-sm text-slate-500">{company?.name ?? "Empresa"} {company?.sector ? `· ${company.sector}` : ""}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-3">
                        <ScorePill score={opp.score} />
                        <StatusBadge status={opp.status} />
                        {profile?.location?.remote_ok && (
                          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg">Remote OK</span>
                        )}
                        {(profile?.min_experience_months ?? 0) > 0 && (
                          <span className="text-xs text-slate-400">
                            {Math.round((profile?.min_experience_months ?? 0) / 12)}+ años exp.
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {opp.status === "completed" ? (
                        <div className="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
                          <CheckCircle size={16} />
                          Completado
                        </div>
                      ) : opp.status === "interviewing" ? (
                        <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold">
                          <MessageCircle size={16} />
                          En proceso
                        </div>
                      ) : canInterview ? (
                        <a
                          href={opp.telegram_url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-md shadow-violet-200 cursor-pointer"
                        >
                          <MessageCircle size={15} />
                          Iniciar entrevista
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Link no disponible</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
