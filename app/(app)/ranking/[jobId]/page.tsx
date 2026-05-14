import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { InviteButton } from "@/components/ranking/invite-button"
import { Upload, Trophy, ArrowLeft } from "lucide-react"
import type { UTLJobProfile } from "@/lib/utl/schema"

function ScorePill({ score, exclusion }: { score: number; exclusion: string | null }) {
  if (exclusion) return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
      Excluido
    </span>
  )
  const cfg = score >= 7
    ? { bg: "bg-emerald-100 text-emerald-700 border-emerald-200", bar: "bg-emerald-500" }
    : score >= 4
    ? { bg: "bg-amber-100 text-amber-700 border-amber-200", bar: "bg-amber-400" }
    : { bg: "bg-red-100 text-red-700 border-red-200", bar: "bg-red-400" }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${cfg.bg}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.bar}`} />
      {score.toFixed(1)}
    </span>
  )
}

function RankBadge({ rank, excluded }: { rank: number; excluded: boolean }) {
  if (excluded) return <span className="text-sm text-slate-300 tabular-nums">—</span>
  if (rank === 1) return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-md shadow-yellow-200">
      <Trophy size={14} className="text-white" />
    </div>
  )
  if (rank === 2) return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 flex items-center justify-center">
      <span className="text-xs font-bold text-white">2</span>
    </div>
  )
  if (rank === 3) return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
      <span className="text-xs font-bold text-white">3</span>
    </div>
  )
  return <span className="text-sm text-slate-400 tabular-nums font-medium">{rank}</span>
}

export default async function RankingPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()
  if (!membership) redirect("/jobs")

  const { data: job } = await service
    .from("jobs").select("id, company_id, utl_job_profile, status")
    .eq("id", jobId).eq("company_id", membership.company_id).single()
  if (!job) redirect("/jobs")

  const profile = job.utl_job_profile as UTLJobProfile

  const { data: rankings } = await service
    .from("ranking_results")
    .select("candidate_id, score_snapshot, rank, profile_summary, pii_unlocked")
    .eq("job_id", jobId).eq("company_id", membership.company_id)
    .order("score_snapshot", { ascending: false })

  const candidateIds = rankings?.map((r) => r.candidate_id) ?? []
  const { data: scores } = candidateIds.length > 0
    ? await service.from("candidate_scores").select("candidate_id, exclusion_reason, breakdown")
        .eq("job_id", jobId).in("candidate_id", candidateIds)
    : { data: [] }

  const scoreByCandidate = new Map(scores?.map((s) => [s.candidate_id, s]) ?? [])
  const activeCount = rankings?.filter((r) => !scoreByCandidate.get(r.candidate_id)?.exclusion_reason).length ?? 0

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-5xl">
          <Link href="/jobs" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3 cursor-pointer">
            <ArrowLeft size={12} /> Volver a cargos
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{profile.title}</h1>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-sm text-slate-500">{activeCount} candidato{activeCount !== 1 ? "s" : ""} calificado{activeCount !== 1 ? "s" : ""}</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-sm text-slate-500">{profile.min_experience_months}m exp. mínima</span>
                <span className="w-1 h-1 rounded-full bg-slate-300" />
                <span className="text-sm text-slate-500">{profile.location.remote_ok ? "Remote OK" : "Presencial"}</span>
              </div>
            </div>
            <Link href="/upload"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-300 hover:text-blue-600 hover:shadow-md transition-all cursor-pointer">
              <Upload size={15} /> Subir CV
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 max-w-5xl">
        {!rankings || rankings.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-16 text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
              <Trophy size={28} className="text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Sin candidatos rankeados</p>
              <p className="text-sm text-slate-500 mt-1">Sube un CV para ver el ranking con score IA</p>
            </div>
            <Link href="/upload"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0369A1] text-white px-6 py-3 text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200 cursor-pointer">
              <Upload size={15} /> Subir CV
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide w-16">Rank</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">Candidato</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">Experiencia</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">Skills</th>
                    <th className="text-left px-5 py-3.5 font-semibold text-slate-500 text-xs uppercase tracking-wide">Score IA</th>
                    <th className="px-5 py-3.5 w-32" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rankings.map((r, idx) => {
                    const summary = r.profile_summary as {
                      current_title: string | null
                      total_experience_months: number
                      top_skills: string[]
                      location_summary: string | null
                      confidence_score: number
                    }
                    const scoreData = scoreByCandidate.get(r.candidate_id)
                    const excluded = scoreData?.exclusion_reason ?? null
                    const isTop = idx === 0 && !excluded

                    return (
                      <tr key={r.candidate_id}
                        className={`transition-colors ${excluded ? "opacity-40" : "hover:bg-blue-50/30"} ${isTop ? "bg-yellow-50/50" : ""}`}>
                        <td className="px-5 py-4">
                          <RankBadge rank={idx + 1} excluded={!!excluded} />
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/candidates/${r.candidate_id}?jobId=${jobId}`}
                            className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition-colors cursor-pointer">
                            {summary.current_title ?? "Título desconocido"}
                          </Link>
                          {excluded && (
                            <p className="text-xs text-red-500 mt-0.5 max-w-xs truncate">{excluded}</p>
                          )}
                          {summary.location_summary && !excluded && (
                            <p className="text-xs text-slate-400 mt-0.5">{summary.location_summary}</p>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-500 text-sm">
                          {summary.total_experience_months >= 12
                            ? `${Math.round(summary.total_experience_months / 12)} año${Math.round(summary.total_experience_months / 12) !== 1 ? "s" : ""}`
                            : `${summary.total_experience_months}m`}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {summary.top_skills.slice(0, 3).map((s) => (
                              <span key={s} className="inline-block rounded-lg px-2 py-0.5 text-xs bg-slate-100 text-slate-600 font-mono border border-slate-200">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <ScorePill score={r.score_snapshot} exclusion={excluded} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {!excluded && <InviteButton candidateId={r.candidate_id} jobId={jobId} />}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
