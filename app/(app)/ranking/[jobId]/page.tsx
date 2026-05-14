import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { InviteButton } from "@/components/ranking/invite-button"
import { Upload, Trophy, Medal } from "lucide-react"
import type { UTLJobProfile } from "@/lib/utl/schema"

function ScoreBadge({ score, exclusion }: { score: number; exclusion: string | null }) {
  if (exclusion) return <Badge variant="destructive">Excluido</Badge>
  const variant = score >= 7 ? "default" : score >= 4 ? "secondary" : "destructive"
  return <Badge variant={variant}>{score.toFixed(1)}</Badge>
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Trophy size={16} className="text-yellow-500" />
  if (rank === 2) return <Medal size={16} className="text-slate-400" />
  if (rank === 3) return <Medal size={16} className="text-amber-600" />
  return <span className="text-sm text-muted-foreground tabular-nums font-medium">{rank}</span>
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
  const topScore = rankings?.[0]?.score_snapshot ?? 0

  return (
    <div className="p-8 max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Ranking</p>
          <h1 className="text-2xl font-bold">{profile.title}</h1>
          <p className="text-sm text-muted-foreground mt-1.5 flex items-center gap-3">
            <span>{rankings?.length ?? 0} candidatos</span>
            <span className="w-px h-3 bg-border" />
            <span>{profile.min_experience_months}m experiencia mínima</span>
            <span className="w-px h-3 bg-border" />
            <span>{profile.location.remote_ok ? "Remote OK" : "Presencial"}</span>
          </p>
        </div>
        <Link href="/upload"
          className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted transition-colors">
          <Upload size={15} />
          Subir CV
        </Link>
      </div>

      {!rankings || rankings.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-16 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
            <Trophy size={24} className="text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">Sin candidatos rankeados</p>
            <p className="text-sm text-muted-foreground mt-1">Sube un CV para ver el ranking</p>
          </div>
          <Link href="/upload"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors">
            <Upload size={15} /> Subir CV
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-5 py-3.5 font-medium text-muted-foreground w-12">#</th>
                <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Candidato</th>
                <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Experiencia</th>
                <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Skills</th>
                <th className="text-left px-5 py-3.5 font-medium text-muted-foreground">Score</th>
                <th className="px-5 py-3.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
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
                    className={`transition-colors ${excluded ? "opacity-50" : "hover:bg-muted/30"} ${isTop ? "bg-yellow-500/5" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center w-7">
                        <RankIcon rank={idx + 1} />
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/candidates/${r.candidate_id}?jobId=${jobId}`}
                        className="font-medium hover:text-primary hover:underline transition-colors">
                        {summary.current_title ?? "Título desconocido"}
                      </Link>
                      {excluded && (
                        <p className="text-xs text-destructive mt-0.5 max-w-xs truncate">{excluded}</p>
                      )}
                      {summary.location_summary && (
                        <p className="text-xs text-muted-foreground mt-0.5">{summary.location_summary}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      {summary.total_experience_months >= 12
                        ? `${Math.round(summary.total_experience_months / 12)} año${Math.round(summary.total_experience_months / 12) !== 1 ? "s" : ""}`
                        : `${summary.total_experience_months}m`}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1 max-w-44">
                        {summary.top_skills.slice(0, 3).map((s) => (
                          <span key={s} className="inline-block rounded-md px-2 py-0.5 text-xs bg-muted font-mono">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <ScoreBadge score={r.score_snapshot} exclusion={excluded} />
                        {isTop && topScore >= 7 && (
                          <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">Top</span>
                        )}
                      </div>
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
      )}
    </div>
  )
}
