import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { InviteButton } from "@/components/ranking/invite-button"
import type { UTLJobProfile } from "@/lib/utl/schema"

function ScoreBadge({ score, exclusion }: { score: number; exclusion: string | null }) {
  if (exclusion) return <Badge variant="destructive">Excluded</Badge>
  const color = score >= 7 ? "default" : score >= 4 ? "secondary" : "destructive"
  return <Badge variant={color}>{score.toFixed(1)}</Badge>
}

export default async function RankingPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()

  // Verify job belongs to user's company
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()

  if (!membership) redirect("/jobs")

  const { data: job } = await service
    .from("jobs")
    .select("id, company_id, utl_job_profile, status")
    .eq("id", jobId)
    .eq("company_id", membership.company_id)
    .single()

  if (!job) redirect("/jobs")

  const profile = job.utl_job_profile as UTLJobProfile

  // Fetch ranking + scores together
  const { data: rankings } = await service
    .from("ranking_results")
    .select("candidate_id, score_snapshot, rank, profile_summary, pii_unlocked")
    .eq("job_id", jobId)
    .eq("company_id", membership.company_id)
    .order("score_snapshot", { ascending: false })

  // Fetch exclusion reasons from candidate_scores
  const candidateIds = rankings?.map((r) => r.candidate_id) ?? []
  const { data: scores } = candidateIds.length > 0
    ? await service
        .from("candidate_scores")
        .select("candidate_id, exclusion_reason, breakdown")
        .eq("job_id", jobId)
        .in("candidate_id", candidateIds)
    : { data: [] }

  const scoreByCandidate = new Map(scores?.map((s) => [s.candidate_id, s]) ?? [])

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{profile.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {rankings?.length ?? 0} candidates · {profile.min_experience_months}mo min experience · {profile.location.remote_ok ? "Remote OK" : "On-site"}
          </p>
        </div>
        <Link href="/upload" className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted transition-colors">
          Upload CV
        </Link>
      </div>

      {!rankings || rankings.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-muted-foreground text-sm">No candidates ranked yet.</p>
          <Link href="/upload" className="text-sm font-medium underline mt-2 inline-block">
            Upload a CV to get started
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground w-10">#</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Candidate</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Experience</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Skills</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Location</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Score</th>
                <th className="px-4 py-3" />
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

                return (
                  <tr key={r.candidate_id} className={`hover:bg-muted/20 transition-colors ${excluded ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 text-muted-foreground tabular-nums">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/candidates/${r.candidate_id}?jobId=${jobId}`}
                        className="font-medium hover:underline"
                      >
                        {summary.current_title ?? "Unknown title"}
                      </Link>
                      {excluded && (
                        <p className="text-xs text-destructive mt-0.5 max-w-xs truncate" title={excluded}>{excluded}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {summary.total_experience_months}mo
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-48">
                        {summary.top_skills.slice(0, 3).map((s) => (
                          <span key={s} className="inline-block rounded px-1.5 py-0.5 text-xs bg-muted font-mono">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {summary.location_summary ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBadge score={r.score_snapshot} exclusion={excluded} />
                    </td>
                    <td className="px-4 py-3">
                      {!excluded && (
                        <InviteButton candidateId={r.candidate_id} jobId={jobId} />
                      )}
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
