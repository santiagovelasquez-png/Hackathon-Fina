import { createClient, createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import Link from "next/link"
import { MapPin, Briefcase, GraduationCap, Languages, Star, Zap, Upload, Calendar, Award } from "lucide-react"
import type { PublicUTL } from "@/lib/utl/schema"

function SkillBadge({ name, category }: { name: string; category: string }) {
  const cfg = {
    technical: "bg-blue-50 text-blue-700 border-blue-200",
    tool: "bg-violet-50 text-violet-700 border-violet-200",
    soft: "bg-emerald-50 text-emerald-700 border-emerald-200",
    domain: "bg-amber-50 text-amber-700 border-amber-200",
  }[category] ?? "bg-slate-50 text-slate-600 border-slate-200"

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${cfg}`}>
      {name}
    </span>
  )
}

function LangBadge({ code, proficiency }: { code: string; proficiency: string }) {
  const level = proficiency === "native" ? "Nativo" : proficiency.toUpperCase()
  const isNative = proficiency === "native"
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-sm font-semibold text-slate-800">{code.toUpperCase() === "ES" ? "Español" : code.toUpperCase() === "EN" ? "English" : code.toUpperCase()}</span>
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isNative ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"}`}>{level}</span>
    </div>
  )
}

function ExpMonths(months: number) {
  if (months >= 12) return `${Math.round(months / 12)} año${Math.round(months / 12) !== 1 ? "s" : ""}`
  return `${months} mes${months !== 1 ? "es" : ""}`
}

function formatDate(d: string | null) {
  if (!d) return "Presente"
  const [y, m] = d.split("-")
  const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
  return `${months[parseInt(m) - 1]} ${y}`
}

export default async function TalentProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/login")

  const service = createServiceClient()
  const { data: candidate } = await service
    .from("candidates")
    .select("id, public_utl, confidence_score")
    .eq("user_id", user.id)
    .single()

  if (!candidate) redirect("/talent/cv")

  const { data: privateData } = await service
    .from("candidate_private_data")
    .select("full_name, email, phone, linkedin_url, portfolio_url")
    .eq("candidate_id", candidate.id)
    .single()

  const utl = candidate.public_utl as PublicUTL
  const name = privateData?.full_name ?? user.email?.split("@")[0] ?? "Profesional"

  const skillsByCategory = {
    technical: utl.skills.filter(s => s.category === "technical"),
    tool: utl.skills.filter(s => s.category === "tool"),
    soft: utl.skills.filter(s => s.category === "soft"),
    domain: utl.skills.filter(s => s.category === "domain"),
  }

  const confidencePct = Math.round((candidate.confidence_score ?? utl.confidence_score ?? 0) * 100)

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#2d1b69] to-[#7c3aed] px-8 pt-10 pb-20">
        <div className="max-w-4xl">
          <div className="flex items-end justify-between">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mb-4 backdrop-blur-sm border border-white/30">
                <span className="text-2xl font-black text-white">{name.slice(0, 2).toUpperCase()}</span>
              </div>
              <h1 className="text-3xl font-bold text-white">{name}</h1>
              <p className="text-violet-200 mt-1 text-base">{utl.current_title ?? "Profesional"}</p>
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {utl.location.city && (
                  <span className="flex items-center gap-1.5 text-sm text-violet-200/80">
                    <MapPin size={13} /> {utl.location.city}{utl.location.country ? `, ${utl.location.country}` : ""}
                  </span>
                )}
                <span className="flex items-center gap-1.5 text-sm text-violet-200/80">
                  <Briefcase size={13} /> {ExpMonths(utl.total_experience_months)} de experiencia
                </span>
                {utl.location.remote && (
                  <span className="text-xs bg-white/15 text-white px-2.5 py-1 rounded-full border border-white/20">Remote OK</span>
                )}
              </div>
            </div>
            <Link href="/talent/cv"
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-all cursor-pointer backdrop-blur-sm">
              <Upload size={14} /> Actualizar CV
            </Link>
          </div>
        </div>
      </div>

      <div className="px-8 -mt-10 max-w-4xl pb-12 space-y-6">
        {/* Confianza IA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center shrink-0">
            <Zap size={20} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold text-slate-700">Confianza del perfil IA</p>
              <p className="text-sm font-bold text-violet-700">{confidencePct}%</p>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-700 rounded-full transition-all"
                style={{ width: `${confidencePct}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400 shrink-0 max-w-36 text-right leading-snug">
            {confidencePct >= 80 ? "Perfil completo y sólido" : confidencePct >= 60 ? "Perfil moderado — considera actualizar" : "Sube más detalles en tu CV"}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left col — Experiencia + Educación */}
          <div className="md:col-span-2 space-y-6">

            {/* Experiencia */}
            {utl.experiences.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
                  <Briefcase size={14} /> Experiencia
                </h2>
                <div className="space-y-5">
                  {utl.experiences.map((exp, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-violet-500 shrink-0 mt-1" />
                        {i < utl.experiences.length - 1 && <div className="w-px flex-1 bg-slate-200 mt-1" />}
                      </div>
                      <div className="pb-4 flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{exp.title}</p>
                        <p className="text-sm text-violet-600 font-medium">{exp.company}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Calendar size={11} className="text-slate-400" />
                          <p className="text-xs text-slate-400">{formatDate(exp.start_date)} → {formatDate(exp.end_date ?? null)} · {ExpMonths(exp.duration_months)}</p>
                        </div>
                        {exp.description && (
                          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{exp.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Educación */}
            {utl.education.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
                  <GraduationCap size={14} /> Educación
                </h2>
                <div className="space-y-4">
                  {utl.education.map((edu, i) => (
                    <div key={i} className="flex gap-4">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <GraduationCap size={15} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{edu.institution}</p>
                        {edu.degree && <p className="text-xs text-slate-600">{edu.degree}{edu.field ? ` · ${edu.field}` : ""}</p>}
                        {(edu.start_date || edu.end_date) && (
                          <p className="text-xs text-slate-400 mt-0.5">{formatDate(edu.start_date)} → {formatDate(edu.end_date ?? null)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Competencias */}
            {utl.competency_evidence.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-5">
                  <Award size={14} /> Competencias detectadas
                </h2>
                <div className="space-y-4">
                  {utl.competency_evidence.map((c, i) => (
                    <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-slate-700 capitalize">{c.competency_name.replace(/_/g, " ")}</p>
                        <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
                          {Math.round(c.confidence_score * 10)}/10
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{c.explanation}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right col — Skills + Idiomas */}
          <div className="space-y-6">

            {/* Skills */}
            <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                <Star size={14} /> Skills
              </h2>
              <div className="space-y-4">
                {skillsByCategory.technical.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-600 mb-2">Técnicas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsByCategory.technical.map(s => <SkillBadge key={s.name} name={s.name} category="technical" />)}
                    </div>
                  </div>
                )}
                {skillsByCategory.tool.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-violet-600 mb-2">Herramientas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsByCategory.tool.map(s => <SkillBadge key={s.name} name={s.name} category="tool" />)}
                    </div>
                  </div>
                )}
                {skillsByCategory.soft.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-600 mb-2">Blandas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsByCategory.soft.map(s => <SkillBadge key={s.name} name={s.name} category="soft" />)}
                    </div>
                  </div>
                )}
                {skillsByCategory.domain.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-600 mb-2">Dominio</p>
                    <div className="flex flex-wrap gap-1.5">
                      {skillsByCategory.domain.map(s => <SkillBadge key={s.name} name={s.name} category="domain" />)}
                    </div>
                  </div>
                )}
                {utl.skills.length === 0 && (
                  <p className="text-xs text-slate-400">No se detectaron skills. Actualiza tu CV.</p>
                )}
              </div>
            </section>

            {/* Idiomas */}
            {utl.languages.length > 0 && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                  <Languages size={14} /> Idiomas
                </h2>
                <div>
                  {utl.languages.map(l => (
                    <LangBadge key={l.code} code={l.code} proficiency={l.proficiency} />
                  ))}
                </div>
              </section>
            )}

            {/* Info de contacto */}
            {privateData && (
              <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Contacto</h2>
                <div className="space-y-2 text-xs text-slate-600">
                  {privateData.email && <p className="truncate">{privateData.email}</p>}
                  {privateData.phone && <p>{privateData.phone}</p>}
                  {privateData.linkedin_url && (
                    <a href={privateData.linkedin_url} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 hover:underline truncate block cursor-pointer">LinkedIn</a>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
