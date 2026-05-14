"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Star, MessageCircle, CheckCircle, Clock, ExternalLink, RefreshCw, Calendar } from "lucide-react"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 1 ? "Hace un momento" : `Hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `Hace ${hrs} hora${hrs !== 1 ? "s" : ""}`
  const days = Math.floor(hrs / 24)
  return `Hace ${days} día${days !== 1 ? "s" : ""}`
}

interface Opportunity {
  id: string
  job_id: string
  company_id: string
  status: string
  score: number
  telegram_url: string | null
  created_at: string
}
interface Job {
  id: string
  utl_job_profile: { title?: string; min_experience_months?: number; location?: { remote_ok?: boolean } }
}
interface Company { id: string; name: string; sector: string | null }

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

export default function OpportunitiesClient({
  candidateId,
  initialOpportunities,
  initialJobs,
  initialCompanies,
  qrMap: initialQrMap,
}: {
  candidateId: string | null
  initialOpportunities: Opportunity[]
  initialJobs: Job[]
  initialCompanies: Company[]
  qrMap: Record<string, string>
}) {
  const router = useRouter()
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [jobs, setJobs] = useState(initialJobs)
  const [companies, setCompanies] = useState(initialCompanies)
  const [qrMap, setQrMap] = useState(initialQrMap)
  const [refreshing, setRefreshing] = useState(false)
  const [lastCount, setLastCount] = useState(initialOpportunities.length)

  const refresh = useCallback(async (silent = false) => {
    if (!candidateId) return
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch(`/api/talent/opportunities?candidate_id=${candidateId}`)
      if (!res.ok) return
      const data = await res.json()
      if (data.opportunities) {
        setOpportunities(data.opportunities)
        setJobs(data.jobs ?? [])
        setCompanies(data.companies ?? [])
        setQrMap(data.qr_map ?? {})
        // New opportunity arrived → force full page refresh for QR generation
        if (data.opportunities.length > lastCount) {
          setLastCount(data.opportunities.length)
          router.refresh()
        }
      }
    } finally {
      if (!silent) setRefreshing(false)
    }
  }, [candidateId, lastCount, router])

  // Poll every 5 seconds
  useEffect(() => {
    if (!candidateId) return
    const interval = setInterval(() => refresh(true), 5000)
    return () => clearInterval(interval)
  }, [candidateId, refresh])

  const jobMap = new Map(jobs.map((j) => [j.id, j]))
  const companyMap = new Map(companies.map((c) => [c.id, c]))

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1e1b4b] to-[#7c3aed] px-8 pt-8 pb-16">
        <div className="max-w-4xl flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Oportunidades</h1>
            <p className="text-violet-300/80 text-sm mt-1">
              La IA seleccionó estas posiciones para tu perfil. Solo aparecen las que mejor coinciden contigo.
            </p>
          </div>
          <button
            onClick={() => refresh(false)}
            disabled={refreshing}
            className="flex items-center gap-2 text-sm text-violet-200/70 hover:text-white border border-white/20 hover:border-white/40 px-3 py-2 rounded-xl transition-all cursor-pointer bg-white/10"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="px-8 -mt-8 max-w-4xl pb-12">
        {opportunities.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-16 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto">
              <Star size={28} className="text-violet-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Sin oportunidades por ahora</p>
              <p className="text-sm text-slate-500 mt-1">
                {!candidateId
                  ? "Primero sube tu CV para que la IA busque oportunidades para ti."
                  : "La IA está buscando posiciones que coincidan con tu perfil. Esta página se actualiza automáticamente."}
              </p>
            </div>
            {candidateId && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                Buscando en tiempo real...
              </div>
            )}
          </div>
        ) : (
          <AnimatePresence>
            <div className="space-y-5">
              {opportunities.map((opp, idx) => {
                const job = jobMap.get(opp.job_id)
                const company = companyMap.get(opp.company_id)
                const profile = job?.utl_job_profile
                const qr = qrMap[opp.id]
                const isPending = opp.status === "pending"

                return (
                  <motion.div
                    key={opp.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:border-violet-200 hover:shadow-lg hover:shadow-violet-50 transition-all"
                  >
                    {/* Card body */}
                    <div className="p-6">
                      <div className="flex items-start gap-4">
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
                            <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                              <Calendar size={10} />
                              {timeAgo(opp.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Telegram CTA */}
                    {isPending && opp.telegram_url && (
                      <div className="border-t border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 px-6 py-5">
                        <div className="flex items-center gap-6">
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
                  </motion.div>
                )
              })}
            </div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
