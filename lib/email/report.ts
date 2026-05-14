import { Resend } from "resend"
import { createServiceClient } from "@/lib/supabase/server"

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = "OpenScout AI <noreply@openscout.ai>"

interface TopCandidate {
  rank: number
  score: number
  current_title: string | null
  full_name: string
  email: string | null
  phone: string | null
  linkedin_url: string | null
  top_skills: string[]
  experience_months: number
  location: string | null
}

export async function sendTopCandidatesReport(opts: {
  jobId: string
  companyId: string
  jobTitle: string
}): Promise<void> {
  const { jobId, companyId, jobTitle } = opts
  const service = createServiceClient()

  // Get top 3 ranking entries for this job
  const { data: rankings } = await service
    .from("ranking_results")
    .select("candidate_id, score_snapshot, profile_summary")
    .eq("job_id", jobId)
    .eq("company_id", companyId)
    .order("score_snapshot", { ascending: false })
    .limit(3)

  if (!rankings || rankings.length === 0) return

  // Only send when at least one has completed the interview
  const candidateIds = rankings.map((r) => r.candidate_id)

  const { data: completedSessions } = await service
    .from("interview_sessions")
    .select("candidate_id")
    .eq("job_id", jobId)
    .eq("status", "completed")
    .in("candidate_id", candidateIds)

  if (!completedSessions || completedSessions.length === 0) return

  // Fetch private contact data for top candidates
  const { data: privateRows } = await service
    .from("candidate_private_data")
    .select("candidate_id, full_name, email, phone, linkedin_url")
    .in("candidate_id", candidateIds)

  const privateByCandidate = new Map(privateRows?.map((r) => [r.candidate_id, r]) ?? [])

  const top: TopCandidate[] = rankings.map((r, idx) => {
    const priv = privateByCandidate.get(r.candidate_id)
    const summary = r.profile_summary as {
      current_title?: string | null
      top_skills?: string[]
      total_experience_months?: number
      location_summary?: string | null
    }
    return {
      rank: idx + 1,
      score: Number(r.score_snapshot),
      current_title: summary?.current_title ?? null,
      full_name: priv?.full_name ?? "Candidato",
      email: priv?.email ?? null,
      phone: priv?.phone ?? null,
      linkedin_url: priv?.linkedin_url ?? null,
      top_skills: summary?.top_skills ?? [],
      experience_months: summary?.total_experience_months ?? 0,
      location: summary?.location_summary ?? null,
    }
  })

  // Get recruiter email from company_members → auth users
  const { data: members } = await service
    .from("company_members")
    .select("user_id")
    .eq("company_id", companyId)
    .limit(1)

  if (!members || members.length === 0) return

  // Use Supabase admin to get user email
  const { data: adminUser } = await service.auth.admin.getUserById(members[0].user_id)
  const recruiterEmail = adminUser?.user?.email
  if (!recruiterEmail) return

  const completedCount = completedSessions.length
  const subject = `OpenScout AI — Top ${top.length} candidatos para "${jobTitle}" (${completedCount} entrevista${completedCount !== 1 ? "s" : ""} completa${completedCount !== 1 ? "s" : ""})`

  const rankEmoji = ["🥇", "🥈", "🥉"]
  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#F8FAFC;margin:0;padding:32px 16px;">
  <div style="max-width:600px;margin:0 auto;">
    <div style="background:linear-gradient(135deg,#0F172A 0%,#4c1d95 100%);border-radius:16px 16px 0 0;padding:32px;text-align:center;">
      <p style="color:#a78bfa;font-size:12px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px;">OpenScout AI</p>
      <h1 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px;">Top ${top.length} candidatos seleccionados</h1>
      <p style="color:#c4b5fd;font-size:14px;margin:0;">${jobTitle}</p>
    </div>

    <div style="background:#fff;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;padding:32px;">
      <p style="color:#475569;font-size:14px;margin:0 0 24px;">
        La IA evaluó todos los candidatos y completó <strong>${completedCount} entrevista${completedCount !== 1 ? "s" : ""}</strong>. Estos son los perfiles más afines al puesto:
      </p>

      ${top.map((c) => `
      <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
          <span style="font-size:24px;">${rankEmoji[c.rank - 1] ?? `#${c.rank}`}</span>
          <div>
            <p style="margin:0;font-weight:700;font-size:16px;color:#0f172a;">${c.full_name}</p>
            <p style="margin:0;font-size:13px;color:#64748b;">${c.current_title ?? "Perfil profesional"}</p>
          </div>
          <div style="margin-left:auto;background:#f1f5f9;border-radius:8px;padding:6px 12px;text-align:center;">
            <p style="margin:0;font-size:18px;font-weight:800;color:#4c1d95;">${c.score.toFixed(1)}</p>
            <p style="margin:0;font-size:10px;color:#94a3b8;text-transform:uppercase;">score</p>
          </div>
        </div>

        <table style="width:100%;font-size:13px;color:#475569;border-collapse:collapse;">
          ${c.email ? `<tr><td style="padding:3px 0;font-weight:600;width:90px;">Email</td><td><a href="mailto:${c.email}" style="color:#4c1d95;">${c.email}</a></td></tr>` : ""}
          ${c.phone ? `<tr><td style="padding:3px 0;font-weight:600;">Teléfono</td><td>${c.phone}</td></tr>` : ""}
          ${c.linkedin_url ? `<tr><td style="padding:3px 0;font-weight:600;">LinkedIn</td><td><a href="${c.linkedin_url}" style="color:#4c1d95;">${c.linkedin_url}</a></td></tr>` : ""}
          ${c.location ? `<tr><td style="padding:3px 0;font-weight:600;">Ubicación</td><td>${c.location}</td></tr>` : ""}
          <tr><td style="padding:3px 0;font-weight:600;">Experiencia</td><td>${c.experience_months >= 12 ? `${Math.round(c.experience_months / 12)} año${Math.round(c.experience_months / 12) !== 1 ? "s" : ""}` : `${c.experience_months} meses`}</td></tr>
        </table>

        ${c.top_skills.length > 0 ? `
        <div style="margin-top:12px;">
          ${c.top_skills.slice(0, 5).map((s) => `<span style="display:inline-block;background:#ede9fe;color:#5b21b6;border-radius:6px;padding:3px 8px;font-size:12px;font-weight:600;margin:2px;">${s}</span>`).join("")}
        </div>` : ""}
      </div>
      `).join("")}

      <div style="border-top:1px solid #e2e8f0;margin-top:24px;padding-top:20px;text-align:center;">
        <p style="color:#94a3b8;font-size:12px;margin:0;">Generado por <strong>OpenScout AI</strong> · Los scores reflejan compatibilidad técnica y entrevista conductual</p>
      </div>
    </div>
  </div>
</body>
</html>`

  await resend.emails.send({
    from: FROM,
    to: recruiterEmail,
    subject,
    html,
  })

  console.log(`[email] Top ${top.length} report sent to ${recruiterEmail} for job=${jobId}`)
}
