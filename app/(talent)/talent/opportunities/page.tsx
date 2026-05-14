import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Star, MessageCircle, CheckCircle, Clock, ExternalLink } from "lucide-react"
import QRCode from "qrcode"

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

  const jobMap = new Map(jobs?.map((j) => [j.id, j]) ?? [])
  const companyMap = new Map(companies?.map((c) => [c.id, c]) ?? [])

  // Pre-generate QR codes for all pending opportunities
  const qrMap = new Map<string, string>()
  for (const opp of opportunities ?? []) {
    if (opp.telegram_url && opp.status === "pending") {
      qrMap.set(opp.id, await generateQR(opp.telegram_url))
    }
  }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1e1b4b] to-[#7c3aed] px-8 pt-8 pb-16">
        <div className="max-w-4xl">
          <h1 className="text-2xl font-bold text-white">Oportunidades</h1>
          <p className="text-violet-300/80 text-sm mt-1">
            La IA seleccionó estas posiciones para tu perfil. Solo aparecen las que mejor coinciden contigo.
          </p>
        </div>
      </div>

      <div className="px-8 -mt-8 max-w-4xl pb-12">
        {!opportunities || opportunities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto">
              <Star size={28} className="text-violet-400" />
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
          <div className="space-y-5">
            {opportunities.map((opp) => {
              const job = jobMap.get(opp.job_id)
              const company = companyMap.get(opp.company_id)
              const profile = job?.utl_job_profile as { title?: string; min_experience_months?: number; location?: { remote_ok?: boolean } } | undefined
              const qr = qrMap.get(opp.id)
              const isPending = opp.status === "pending"

              return (
                <div key={opp.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-violet-200 hover:shadow-lg hover:shadow-violet-50 transition-all">
                  {/* Card header */}
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Company avatar */}
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 shadow-md shadow-violet-200">
                        <span className="text-lg font-black text-white">
                          {(company?.name ?? "?").slice(0, 1).toUpperCase()}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-slate-900 text-base">{profile?.title ?? "Cargo"}</p>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {company?.name ?? "Empresa"}
                          {company?.sector ? <span className="text-slate-400"> · {company.sector}</span> : null}
                        </p>
                        <div className="flex items-center gap-2.5 mt-3 flex-wrap">
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
                    </div>
                  </div>

                  {/* Telegram CTA — only for pending */}
                  {isPending && opp.telegram_url && (
                    <div className="border-t border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 px-6 py-5">
                      <div className="flex items-center gap-6">
                        {/* QR code */}
                        {qr && (
                          <div className="shrink-0">
                            <div className="w-[88px] h-[88px] rounded-xl overflow-hidden border-2 border-violet-200 bg-white p-1 shadow-sm">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={qr} alt="QR Telegram" width={80} height={80} className="w-full h-full" />
                            </div>
                            <p className="text-xs text-slate-400 text-center mt-1">Escanea</p>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 mb-0.5">¡Fuiste seleccionado!</p>
                          <p className="text-xs text-slate-500 leading-relaxed mb-3">
                            Escanea el QR o toca el botón para iniciar tu entrevista por Telegram.
                            El bot te guiará paso a paso — tarda unos 10 minutos.
                          </p>
                          <a
                            href={opp.telegram_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-violet-800 hover:from-violet-700 hover:to-violet-900 text-white text-sm font-bold px-5 py-2.5 rounded-xl shadow-md shadow-violet-300 transition-all cursor-pointer"
                          >
                            <MessageCircle size={15} />
                            Iniciar entrevista en Telegram
                            <ExternalLink size={13} className="opacity-70" />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Completed / interviewing state */}
                  {opp.status === "completed" && (
                    <div className="border-t border-slate-100 bg-emerald-50 px-6 py-4 flex items-center gap-2">
                      <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                      <p className="text-sm font-semibold text-emerald-700">Entrevista completada — el recruiter está revisando tu perfil.</p>
                    </div>
                  )}
                  {opp.status === "interviewing" && (
                    <div className="border-t border-slate-100 bg-blue-50 px-6 py-4 flex items-center gap-3">
                      <MessageCircle size={16} className="text-blue-600 shrink-0" />
                      <p className="text-sm font-semibold text-blue-700">Entrevista en curso — continúa en Telegram.</p>
                      {opp.telegram_url && (
                        <a href={opp.telegram_url} target="_blank" rel="noopener noreferrer"
                          className="ml-auto text-xs text-blue-600 hover:underline flex items-center gap-1 cursor-pointer">
                          Abrir <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
