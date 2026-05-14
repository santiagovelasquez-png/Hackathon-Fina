"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { FileText, Mic, ClipboardList, Upload, Square, Loader2, CheckCircle } from "lucide-react"

interface Skill { name: string; required: boolean }
interface Competency { name: string; minimum_score: number }
type Mode = "form" | "document" | "voice"

export default function NewJobPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("form")
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [parsedOk, setParsedOk] = useState(false)

  // Form state
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [minExperience, setMinExperience] = useState(12)
  const [remoteOk, setRemoteOk] = useState(true)
  const [skills, setSkills] = useState<Skill[]>([
    { name: "", required: true },
    { name: "", required: true },
    { name: "", required: false },
  ])
  const [competencies, setCompetencies] = useState<Competency[]>([
    { name: "problem_solving", minimum_score: 6 },
    { name: "collaboration", minimum_score: 5 },
  ])

  // Voice state
  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  // Document state
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function applyParsed(data: { title: string; description: string; required_skills: Skill[]; competencies: Competency[]; min_experience_months: number }) {
    if (data.title) setTitle(data.title)
    if (data.description) setDescription(data.description)
    if (data.required_skills?.length) setSkills(data.required_skills.filter((s) => s.name))
    if (data.competencies?.length) setCompetencies(data.competencies.filter((c) => c.name))
    if (data.min_experience_months) setMinExperience(data.min_experience_months)
    setParsedOk(true)
    setMode("form")
  }

  async function parseFile(file: File) {
    setParsing(true)
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/jobs/parse", { method: "POST", body: formData })
    const data = await res.json()
    setParsing(false)
    if (!res.ok) { setError(data.error ?? "Parse failed"); return }
    applyParsed(data)
  }

  async function parseVoice() {
    if (!transcript.trim()) return
    setParsing(true)
    setError(null)
    const res = await fetch("/api/jobs/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    })
    const data = await res.json()
    setParsing(false)
    if (!res.ok) { setError(data.error ?? "Parse failed"); return }
    applyParsed(data)
  }

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) { setError("Speech recognition not supported. Use Chrome or Edge, or type manually below."); return }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec = new SR() as any
    rec.continuous = true
    rec.interimResults = true
    rec.lang = "es-ES"
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(" ")
      setTranscript(t)
    }
    rec.onerror = () => setRecording(false)
    rec.onend = () => setRecording(false)
    rec.start()
    recognitionRef.current = rec
    setRecording(true)
    setTranscript("")
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setRecording(false)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) parseFile(file)
  }, [])

  function updateSkill(i: number, field: keyof Skill, value: string | boolean) {
    setSkills((p) => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function updateCompetency(i: number, field: keyof Competency, value: string | number) {
    setCompetencies((p) => p.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        required_skills: skills.filter((s) => s.name.trim()),
        competencies: competencies.filter((c) => c.name.trim()),
        min_experience_months: minExperience,
        location: { country: null, remote_ok: remoteOk },
      }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) { setError(data.error ?? "Failed to create job"); return }
    router.push(`/ranking/${data.job_id}`)
  }

  const MODES: { id: Mode; label: string; Icon: React.ElementType; desc: string }[] = [
    { id: "form", label: "Formulario", Icon: ClipboardList, desc: "Completa el perfil manualmente" },
    { id: "document", label: "Subir documento", Icon: FileText, desc: "PDF o descripción del cargo" },
    { id: "voice", label: "Describir por voz", Icon: Mic, desc: "Habla y la IA extrae el perfil" },
  ]

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Nuevo cargo</h1>
        <p className="text-sm text-muted-foreground mt-1">Elige cómo quieres crear el perfil del cargo</p>
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-3">
        {MODES.map(({ id, label, Icon, desc }) => (
          <button
            key={id}
            type="button"
            onClick={() => { setMode(id); setError(null); setParsedOk(false) }}
            className={`rounded-xl border-2 p-4 text-left transition-all ${
              mode === id
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
          >
            <Icon size={20} className={mode === id ? "text-primary" : "text-muted-foreground"} />
            <p className={`text-sm font-medium mt-2 ${mode === id ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </button>
        ))}
      </div>

      {/* Document mode */}
      {mode === "document" && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-all ${
              dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            }`}
          >
            {parsing ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Analizando documento...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload size={32} className="text-muted-foreground" />
                <p className="text-sm font-medium">Arrastra un PDF o haz click para seleccionar</p>
                <p className="text-xs text-muted-foreground">Job description, perfil del cargo, brief de RRHH</p>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
        </div>
      )}

      {/* Voice mode */}
      {mode === "voice" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              Describe el cargo en voz alta: título, responsabilidades, skills requeridas, años de experiencia, etc.
            </p>
            <div className="flex gap-3">
              {!recording ? (
                <Button type="button" onClick={startRecording} className="gap-2">
                  <Mic size={16} /> Comenzar a grabar
                </Button>
              ) : (
                <Button type="button" onClick={stopRecording} variant="destructive" className="gap-2">
                  <Square size={16} /> Detener grabación
                </Button>
              )}
            </div>
            {recording && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                Grabando...
              </div>
            )}
            {transcript && (
              <div className="space-y-2">
                <Label>Transcripción</Label>
                <Textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4} className="text-sm" />
              </div>
            )}
            {!transcript && !recording && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">¿No tienes micrófono? Escribe la descripción directamente:</p>
                <Textarea
                  placeholder="Ej: Busco un backend engineer con experiencia en Python y FastAPI, mínimo 2 años, para trabajar en producto B2B SaaS..."
                  rows={4}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                />
              </div>
            )}
            {transcript && !recording && (
              <Button type="button" onClick={parseVoice} disabled={parsing} className="gap-2">
                {parsing ? <Loader2 size={16} className="animate-spin" /> : null}
                {parsing ? "Analizando..." : "Extraer perfil con IA"}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Success banner after parse */}
      {parsedOk && (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle size={16} />
          Perfil extraído por IA. Revisa y ajusta los campos antes de crear.
        </div>
      )}

      {/* Form (always shown when mode=form, or after parse) */}
      {mode === "form" && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título del cargo</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backend Engineer" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Descripción</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="¿En qué consiste este rol?" required />
            </div>
            <div className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="exp">Experiencia mínima (meses)</Label>
                <Input id="exp" type="number" min={0} value={minExperience} onChange={(e) => setMinExperience(Number(e.target.value))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer pb-1.5">
                <input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} className="rounded" />
                <span className="text-sm">Remote OK</span>
              </label>
            </div>
          </div>

          {/* Skills */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Skills requeridas</Label>
                <p className="text-xs text-muted-foreground mt-0.5">La IA asigna la importancia automáticamente</p>
              </div>
              <button type="button" onClick={() => setSkills((p) => [...p, { name: "", required: false }])}
                className="text-xs text-primary hover:underline">+ agregar skill</button>
            </div>
            {skills.map((s, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={s.name} onChange={(e) => updateSkill(i, "name", e.target.value)} placeholder="ej. Python" className="flex-1" />
                <label className="flex items-center gap-1.5 text-xs whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={s.required} onChange={(e) => updateSkill(i, "required", e.target.checked)} className="rounded" />
                  requerida
                </label>
                {skills.length > 1 && (
                  <button type="button" onClick={() => setSkills((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive text-lg leading-none">×</button>
                )}
              </div>
            ))}
          </div>

          {/* Competencies */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Competencias</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Score mínimo aceptable (1-10)</p>
              </div>
              <button type="button" onClick={() => setCompetencies((p) => [...p, { name: "", minimum_score: 5 }])}
                className="text-xs text-primary hover:underline">+ agregar</button>
            </div>
            {competencies.map((c, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input value={c.name} onChange={(e) => updateCompetency(i, "name", e.target.value)} placeholder="ej. problem_solving" className="flex-1" />
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs text-muted-foreground">mín.</span>
                  <input type="number" min={1} max={10} value={c.minimum_score}
                    onChange={(e) => updateCompetency(i, "minimum_score", parseInt(e.target.value))}
                    className="w-14 rounded-md border border-input bg-background px-2 py-1 text-sm text-center" />
                  <span className="text-xs text-muted-foreground">/10</span>
                </div>
                {competencies.length > 1 && (
                  <button type="button" onClick={() => setCompetencies((p) => p.filter((_, idx) => idx !== i))}
                    className="text-muted-foreground hover:text-destructive text-lg leading-none">×</button>
                )}
              </div>
            ))}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? <><Loader2 size={16} className="animate-spin mr-2" />Creando...</> : "Crear cargo"}
          </Button>
        </form>
      )}

      {error && mode !== "form" && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
