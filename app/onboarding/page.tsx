"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Zap, Building2, Users, Briefcase, ChevronRight, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const SECTORS = [
  "Tecnología", "Fintech", "Salud", "Retail", "Educación",
  "Manufactura", "Servicios", "Logística", "Consultoría", "Otro",
]

const SIZES = [
  { label: "1–10", desc: "Startup" },
  { label: "11–50", desc: "Pequeña" },
  { label: "51–200", desc: "Mediana" },
  { label: "201–1000", desc: "Grande" },
  { label: "1000+", desc: "Corporativo" },
]

const ROLE_SUGGESTIONS = [
  "Software Engineer", "Product Manager", "Data Scientist", "DevOps",
  "UX Designer", "Frontend Developer", "Backend Developer", "Full Stack",
  "Data Engineer", "QA Engineer", "Tech Lead", "CTO", "Marketing",
  "Ventas", "Customer Success", "Operaciones", "Finanzas", "RRHH",
]

type Step = 0 | 1 | 2 | 3

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [companyName, setCompanyName] = useState("")
  const [sector, setSector] = useState("")
  const [size, setSize] = useState("")
  const [roles, setRoles] = useState<string[]>([])
  const [customRole, setCustomRole] = useState("")

  function toggleRole(role: string) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    )
  }

  function addCustomRole() {
    const trimmed = customRole.trim()
    if (trimmed && !roles.includes(trimmed)) {
      setRoles((prev) => [...prev, trimmed])
      setCustomRole("")
    }
  }

  async function handleComplete() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/company/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company_name: companyName, sector, company_size: size, typical_roles: roles }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? "Error guardando datos")
      }
      router.push("/dashboard")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
      setLoading(false)
    }
  }

  const progressPct = step === 1 ? 33 : step === 2 ? 66 : 100

  async function handleTalent() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/talent/onboarding", { method: "POST" })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? "Error guardando datos")
      }
      router.push("/talent/cv")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0F172A] via-[#1e3a5f] to-[#0369A1] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-lg shadow-blue-900/40">
            <Zap size={18} className="text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-xl tracking-tight">OpenScout AI</span>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-black/20 p-8 border border-white/60">

          {/* Step 0: User type */}
          {step === 0 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">¿Cómo usarás OpenScout AI?</h2>
                <p className="text-sm text-slate-500">Selecciona tu perfil para personalizar tu experiencia.</p>
              </div>
              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 hover:border-blue-400 hover:bg-blue-50/50 transition-all duration-200 cursor-pointer group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <Building2 size={26} className="text-blue-600" />
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900 text-sm">Soy una empresa</p>
                    <p className="text-xs text-slate-500 mt-1">Busco talento para mi equipo</p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={handleTalent}
                  disabled={loading}
                  className="flex flex-col items-center gap-4 rounded-2xl border-2 border-slate-200 bg-slate-50 p-6 hover:border-violet-400 hover:bg-violet-50/50 transition-all duration-200 cursor-pointer group disabled:opacity-60"
                >
                  <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                    {loading ? <Loader2 size={26} className="text-violet-600 animate-spin" /> : <Users size={26} className="text-violet-600" />}
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-slate-900 text-sm">Soy un profesional</p>
                    <p className="text-xs text-slate-500 mt-1">Busco oportunidades laborales</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Progress (steps 1-3 only) */}
          {step > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Configuración inicial</p>
                <p className="text-xs text-slate-400">Paso {step} de 3</p>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-700 rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Step 1: Empresa */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
                  <Building2 size={22} className="text-blue-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">Cuéntanos sobre tu empresa</h2>
                <p className="text-sm text-slate-500">Esta información nos ayuda a personalizar tus recomendaciones.</p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-xs font-semibold text-slate-600">Nombre de la empresa</Label>
                  <Input
                    id="company"
                    placeholder="Ej. TechCorp Latam"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">Sector / Industria</Label>
                  <div className="flex flex-wrap gap-2">
                    {SECTORS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSector(s)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                          sector === s
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-600">Tamaño de la empresa</Label>
                  <div className="grid grid-cols-5 gap-2">
                    {SIZES.map(({ label, desc }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSize(label)}
                        className={`flex flex-col items-center py-2.5 px-1 rounded-xl border text-center transition-all cursor-pointer ${
                          size === label
                            ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
                            : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        <span className="text-xs font-bold leading-none mb-1">{label}</span>
                        <span className={`text-[10px] leading-none ${size === label ? "text-blue-100" : "text-slate-400"}`}>{desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Button
                onClick={() => setStep(2)}
                disabled={!companyName.trim() || !sector || !size}
                className="w-full h-11 text-sm font-semibold rounded-xl cursor-pointer"
              >
                Continuar <ChevronRight size={16} className="ml-1" />
              </Button>
            </div>
          )}

          {/* Step 2: Perfiles */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mb-4">
                  <Users size={22} className="text-violet-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">¿Qué perfiles buscas?</h2>
                <p className="text-sm text-slate-500">Selecciona los roles que típicamente contratas. Así podemos recomendarte candidatos del pool.</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                  {ROLE_SUGGESTIONS.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        roles.includes(role)
                          ? "bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-200"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:border-violet-300 hover:text-violet-600"
                      }`}
                    >
                      {roles.includes(role) && <CheckCircle size={10} className="inline mr-1" />}
                      {role}
                    </button>
                  ))}
                </div>

                {/* Custom role */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar otro rol..."
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomRole())}
                    className="h-9 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addCustomRole}
                    disabled={!customRole.trim()}
                    className="h-9 text-xs cursor-pointer"
                  >
                    Agregar
                  </Button>
                </div>

                {roles.length > 0 && (
                  <p className="text-xs text-slate-500">
                    {roles.length} rol{roles.length !== 1 ? "es" : ""} seleccionado{roles.length !== 1 ? "s" : ""}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 h-11 text-sm rounded-xl cursor-pointer">
                  Atrás
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={roles.length === 0}
                  className="flex-1 h-11 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  Continuar <ChevronRight size={16} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Confirmar */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
                  <Briefcase size={22} className="text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-1">¡Todo listo!</h2>
                <p className="text-sm text-slate-500">Confirma los datos de tu empresa antes de entrar al dashboard.</p>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-200">
                <Row icon={Building2} label="Empresa" value={companyName} />
                <Row icon={Briefcase} label="Sector" value={sector} />
                <Row icon={Users} label="Tamaño" value={size} />
                <div className="pt-3 border-t border-slate-200">
                  <p className="text-xs font-semibold text-slate-500 mb-2">Perfiles que buscan</p>
                  <div className="flex flex-wrap gap-1.5">
                    {roles.map((r) => (
                      <span key={r} className="text-xs bg-violet-100 text-violet-700 px-2.5 py-1 rounded-lg font-semibold border border-violet-200">{r}</span>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(2)} disabled={loading} className="flex-1 h-11 text-sm rounded-xl cursor-pointer">
                  Editar
                </Button>
                <Button
                  onClick={handleComplete}
                  disabled={loading}
                  className="flex-1 h-11 text-sm font-semibold rounded-xl cursor-pointer"
                >
                  {loading ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
                  Ir al dashboard
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-blue-200/40 mt-6">OpenScout AI · Powered by Gemini 2.5 Pro</p>
      </div>
    </div>
  )
}

function Row({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon size={15} className="text-slate-400 shrink-0" />
      <span className="text-xs text-slate-500 w-16 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{value}</span>
    </div>
  )
}
