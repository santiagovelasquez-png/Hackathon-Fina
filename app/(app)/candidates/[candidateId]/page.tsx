import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import type { PublicUTL, CandidateScore } from "@/lib/utl/schema"

export default async function CandidateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>
  searchParams: Promise<{ jobId?: string }>
}) {
  const { candidateId } = await params
  const { jobId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: membership } = await service
    .from("company_members").select("company_id").eq("user_id", user.id).single()
  if (!membership) redirect("/dashboard")

  // Verify access via ranking_results
  const { data: rankingEntry } = await service
    .from("ranking_results")
    .select("score_snapshot, profile_summary")
    .eq("candidate_id", candidateId)
    .eq("company_id", membership.company_id)
    .maybeSingle()

  if (!rankingEntry) redirect("/jobs")

  const { data: candidate } = await service
    .from("candidates")
    .select("public_utl, confidence_score, source_type, ingested_at")
    .eq("id", candidateId)
    .single()

  if (!candidate) redirect("/jobs")

  const utl = candidate.public_utl as PublicUTL

  // Score breakdown — only if job belongs to this company
  let scoreData: CandidateScore | null = null
  if (jobId) {
    const { data: job } = await service
      .from("jobs").select("company_id").eq("id", jobId).single()

    if (job?.company_id === membership.company_id) {
      const { data: score } = await service
        .from("candidate_scores")
        .select("*")
        .eq("candidate_id", candidateId)
        .eq("job_id", jobId)
        .single()
      scoreData = score as CandidateScore | null
    }
  }

  const technicalSkills = utl.skills.filter((s) => s.category === "technical" || s.category === "tool")
  const softSkills = utl.skills.filter((s) => s.category === "soft" || s.category === "domain")

  return (
    <div className="p-8 max-w-3xl space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{utl.current_title ?? "Candidate"}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {utl.total_experience_months} months experience
              {utl.location.city || utl.location.country
                ? ` · ${[utl.location.city, utl.location.country].filter(Boolean).join(", ")}`
                : ""}
              {utl.location.remote ? " · Remote OK" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{candidate.source_type}</Badge>
            <Badge variant={utl.confidence_score > 0.6 ? "default" : "secondary"}>
              {Math.round(utl.confidence_score * 100)}% confidence
            </Badge>
          </div>
        </div>
        {utl.languages.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Languages: {utl.languages.map((l) => `${l.code.toUpperCase()} (${l.proficiency})`).join(", ")}
          </p>
        )}
      </div>

      <Separator />

      {/* Score breakdown */}
      {scoreData && (
        <div className="space-y-3">
          <h2 className="font-semibold">Score breakdown</h2>
          <div className="grid grid-cols-5 gap-2">
            {scoreData.breakdown.map((d) => (
              <div key={d.dimension} className="rounded-lg border border-border p-3 text-center space-y-1">
                <p className="text-xl font-bold tabular-nums">{d.score.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground capitalize">{d.dimension.replace(/_/g, " ")}</p>
                <p className="text-xs text-muted-foreground">×{d.weight}</p>
              </div>
            ))}
          </div>
          <p className="text-sm">
            Total score: <span className="font-bold">{scoreData.total_score.toFixed(1)}</span>
            {scoreData.exclusion_reason && (
              <span className="ml-2 text-destructive">· {scoreData.exclusion_reason}</span>
            )}
          </p>
        </div>
      )}

      {/* Skills */}
      {utl.skills.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Skills</h2>
          {technicalSkills.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Technical & Tools</p>
              <div className="flex flex-wrap gap-2">
                {technicalSkills.map((s) => (
                  <span key={s.name} className="rounded-md bg-muted px-2 py-1 text-xs font-mono">
                    {s.name}
                    {s.proficiency && <span className="text-muted-foreground"> · {s.proficiency}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {softSkills.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Soft & Domain</p>
              <div className="flex flex-wrap gap-2">
                {softSkills.map((s) => (
                  <span key={s.name} className="rounded-md bg-muted px-2 py-1 text-xs">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Experience */}
      {utl.experiences.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Experience</h2>
          <div className="space-y-4">
            {utl.experiences.map((exp, i) => (
              <div key={i} className="flex gap-4">
                <div className="w-1 bg-border rounded-full shrink-0" />
                <div className="space-y-1 pb-2">
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {exp.company} · {exp.start_date} – {exp.end_date ?? "Present"} · {exp.duration_months}mo
                  </p>
                  {exp.description && <p className="text-sm text-muted-foreground">{exp.description}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Education */}
      {utl.education.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Education</h2>
          <div className="space-y-2">
            {utl.education.map((edu, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{edu.institution}</p>
                <p className="text-muted-foreground">
                  {[edu.degree, edu.field].filter(Boolean).join(", ")}
                  {edu.start_date && ` · ${edu.start_date} – ${edu.end_date ?? "Present"}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competency evidence */}
      {utl.competency_evidence.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold">Competency evidence</h2>
          <div className="space-y-3">
            {utl.competency_evidence.map((ev, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{ev.competency_name}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(ev.confidence_score * 100)}% confidence</span>
                </div>
                <p className="text-sm">{ev.evidence_text}</p>
                <p className="text-xs text-muted-foreground italic">{ev.explanation}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {utl.flags.filter((f) => f.severity === "error").length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-destructive">Flags</h2>
          {utl.flags.map((f, i) => (
            <p key={i} className="text-sm text-destructive">{f.field}: {f.reason}</p>
          ))}
        </div>
      )}
    </div>
  )
}
