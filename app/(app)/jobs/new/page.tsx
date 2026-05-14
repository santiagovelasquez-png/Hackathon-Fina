"use client"

import { useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"
import { FileText, Mic, ClipboardList, Upload, Square, Loader2, CheckCircle, Plus, X, Zap, Sparkles, ChevronRight } from "lucide-react"

interface Skill { name: string; required: boolean }
interface Competency { name: string; minimum_score: number }
type Mode = "form" | "document" | "voice"

const COMPETENCY_PRESETS = [
  "problem_solving", "collaboration", "leadership", "communication",
  "adaptability", "critical_thinking", "initiative", "time_management",
]

export default function NewJobPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>("form")
  const [loading, setLoading] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [parsedOk, setParsedOk] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [parseStep, setParseStep] = useState(0)

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

  const [recording, setRecording] = useState(false)
  const [transcript, setTranscript] = useState("")
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
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

  const PARSE_STEPS = ["Leyendo documento", "Extrayendo perfil", "Validando estructura"]

  async function parseFile(file: File) {
    setParsing(true)
    setParseStep(0)
    const stepInterval = setInterval(() => setParseStep((p) => Math.min(p + 1, PARSE_STEPS.length - 1)), 2000)
    const formData = new FormData()
    formData.append("file", file)
    const res = await fetch("/api/jobs/parse", { method: "POST", body: formData })
    clearInterval(stepInterval)
    const data = await res.json()
    setParsing(false)
    if (!res.ok) { toast.error("Error al analizar documento", { description: data.error ?? "Parse failed" }); return }
    toast.success("Perfil extraído por IA", { description: "Revisa y ajusta los campos antes de crear." })
    applyParsed(data)
  }

  async function parseVoice() {
    if (!transcript.trim()) return
    setParsing(true)
    setParseStep(0)
    const stepInterval = setInterval(() => setParseStep((p) => Math.min(p + 1, PARSE_STEPS.length - 1)), 1500)
    const res = await fetch("/api/jobs/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: transcript }),
    })
    clearInterval(stepInterval)
    const data = await res.json()
    setParsing(false)
    if (!res.ok) { toast.error("Error al analizar texto", { description: data.error ?? "Parse failed" }); return }
    toast.success("Perfil extraído por IA")
    applyParsed(data)
  }

  function startRecording() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition
    if (!SR) {
      toast.error("Reconocimiento de voz no soportado", { description: "Usa Chrome o Edge, o escribe directamente." })
      return
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function updateSkill(i: number, field: keyof Skill, value: string | boolean) {
    setSkills((p) => p.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function updateCompetency(i: number, field: keyof Competency, value: string | number) {
    setCompetencies((p) => p.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { toast.error("El título es obligatorio"); return }
    setLoading(true)
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
    if (!res.ok) { toast.error("Error al crear cargo", { description: data.error ?? "Failed" }); return }
    toast.success("Cargo creado", { description: "La IA ya está buscando candidatos." })
    router.push(`/ranking/${data.job_id}`)
  }

  const MODES = [
    { id: "form" as Mode, label: "Formulario", Icon: ClipboardList, desc: "Completa el perfil manualmente", color: "from-violet-500 to-violet-700" },
    { id: "document" as Mode, label: "Subir documento", Icon: FileText, desc: "PDF o descripción del cargo", color: "from-blue-500 to-blue-700" },
    { id: "voice" as Mode, label: "Describir por voz", Icon: Mic, desc: "Habla y la IA extrae el perfil", color: "from-emerald-500 to-emerald-700" },
  ]

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#0F172A] via-[#1e1b4b] to-[#7c3aed] px-8 pt-8 pb-16">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-violet-300/60 text-sm mb-4">
            <span>Cargos</span>
            <ChevronRight size={14} />
            <span className="text-violet-200">Nuevo cargo</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Crear nuevo cargo</h1>
          <p className="text-violet-300/80 text-sm mt-1">Elige cómo quieres definir el perfil — la IA hace el resto</p>
        </div>
      </div>

      <div className="px-8 -mt-8 max-w-3xl pb-16 space-y-6">
        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-4">
          {MODES.map(({ id, label, Icon, desc, color }) => (
            <motion.button
              key={id}
              type="button"
              onClick={() => { setMode(id); setParsedOk(false) }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              className={`rounded-2xl border-2 p-5 text-left transition-all cursor-pointer shadow-sm ${
                mode === id
                  ? "border-violet-500 bg-white shadow-violet-100"
                  : "border-slate-200 bg-white hover:border-violet-300"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3 shadow-sm`}>
                <Icon size={18} className="text-white" />
              </div>
              <p className={`text-sm font-semibold ${mode === id ? "text-slate-900" : "text-slate-600"}`}>{label}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-snug">{desc}</p>
              {mode === id && (
                <motion.div
                  layoutId="mode-indicator"
                  className="mt-2 w-5 h-1 rounded-full bg-violet-500"
                />
              )}
            </motion.button>
          ))}
        </div>

        {/* AI parsed banner */}
        <AnimatePresence>
          {parsedOk && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Sparkles size={15} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800">Perfil extraído por IA</p>
                <p className="text-xs text-emerald-600">Revisa y ajusta los campos antes de crear el cargo.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Panel content */}
        <AnimatePresence mode="wait">
          {/* Document mode */}
          {mode === "document" && (
            <motion.div
              key="document"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="p-6">
                <motion.div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  onClick={() => !parsing && fileInputRef.current?.click()}
                  animate={{
                    borderColor: dragOver ? "#8b5cf6" : parsing ? "#6366f1" : "#e2e8f0",
                    backgroundColor: dragOver ? "#f5f3ff" : "#fafafa",
                  }}
                  className="rounded-xl border-2 border-dashed p-12 text-center cursor-pointer transition-colors"
                >
                  {parsing ? (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative w-16 h-16">
                        <div className="absolute inset-0 rounded-full border-4 border-violet-100" />
                        <div className="absolute inset-0 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Zap size={20} className="text-violet-500" />
                        </div>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">Procesando con IA...</p>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={parseStep}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="text-sm text-violet-500 mt-1"
                          >
                            {PARSE_STEPS[parseStep]}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                      <div className="flex gap-1.5">
                        {PARSE_STEPS.map((_, i) => (
                          <motion.div
                            key={i}
                            animate={{ backgroundColor: i <= parseStep ? "#8b5cf6" : "#e2e8f0" }}
                            className="w-2 h-2 rounded-full"
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ scale: dragOver ? 1.15 : 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                        className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center"
                      >
                        <Upload size={26} className="text-blue-500" />
                      </motion.div>
                      <div>
                        <p className="font-semibold text-slate-800">
                          {dragOver ? "Suelta para analizar" : "Arrastra tu documento aquí"}
                        </p>
                        <p className="text-sm text-slate-400 mt-1">PDF, DOC, DOCX o TXT · Job description, brief de RRHH</p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
                        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-colors cursor-pointer"
                      >
                        Seleccionar archivo
                      </button>
                    </div>
                  )}
                </motion.div>
                <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.txt" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f) }} />
              </div>
            </motion.div>
          )}

          {/* Voice mode */}
          {mode === "voice" && (
            <motion.div
              key="voice"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm"
            >
              <div className="p-6 space-y-5">
                {/* Mic button */}
                <div className="flex flex-col items-center gap-5 py-4">
                  <div className="relative">
                    {recording && (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-0 rounded-full bg-red-400"
                        />
                        <motion.div
                          animate={{ scale: [1, 1.7, 1], opacity: [0.25, 0, 0.25] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
                          className="absolute inset-0 rounded-full bg-red-400"
                        />
                      </>
                    )}
                    <motion.button
                      type="button"
                      onClick={recording ? stopRecording : startRecording}
                      whileTap={{ scale: 0.94 }}
                      className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors cursor-pointer ${
                        recording
                          ? "bg-red-500 shadow-red-200"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-200"
                      }`}
                    >
                      {recording
                        ? <Square size={24} className="text-white" fill="white" />
                        : <Mic size={28} className="text-white" />}
                    </motion.button>
                  </div>

                  {recording ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <motion.div
                            key={i}
                            animate={{ height: ["8px", "24px", "8px"] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
                            className="w-1 bg-red-400 rounded-full"
                          />
                        ))}
                      </div>
                      <p className="text-sm font-semibold text-red-600">Grabando — toca para detener</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className="text-sm font-semibold text-slate-700">
                        {transcript ? "Grabación lista" : "Toca para grabar"}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {transcript ? "Edita el texto o extrae el perfil" : "Describe título, skills, experiencia requerida"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Transcript */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {transcript ? "Transcripción" : "O escribe directamente"}
                  </label>
                  <textarea
                    value={transcript}
                    onChange={(e) => setTranscript(e.target.value)}
                    rows={4}
                    placeholder="Ej: Busco un backend engineer con experiencia en Python y FastAPI, mínimo 2 años, para trabajar en producto B2B SaaS..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
                  />
                </div>

                {transcript && !recording && (
                  <motion.button
                    type="button"
                    onClick={parseVoice}
                    disabled={parsing}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white font-semibold py-3 rounded-xl shadow-sm hover:shadow-emerald-200 hover:shadow-md transition-all cursor-pointer disabled:opacity-60"
                  >
                    {parsing ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={parseStep}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                          >
                            {PARSE_STEPS[parseStep]}...
                          </motion.span>
                        </AnimatePresence>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} />
                        Extraer perfil con IA
                      </>
                    )}
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}

          {/* Form mode */}
          {mode === "form" && (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              onSubmit={handleSubmit}
              className="space-y-5"
            >
              {/* Basic info card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Información básica</h3>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="title">Título del cargo</label>
                  <input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="ej. Backend Engineer, Product Manager..."
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="desc">Descripción del rol</label>
                  <textarea
                    id="desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="¿En qué consiste este rol? Responsabilidades principales..."
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700" htmlFor="exp">Experiencia mínima</label>
                    <div className="relative">
                      <input
                        id="exp"
                        type="number"
                        min={0}
                        value={minExperience}
                        onChange={(e) => setMinExperience(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent pr-14"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">meses</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-slate-700">Modalidad</label>
                    <button
                      type="button"
                      onClick={() => setRemoteOk((p) => !p)}
                      className={`w-full rounded-xl border-2 py-3 px-4 text-sm font-semibold transition-all cursor-pointer ${
                        remoteOk
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {remoteOk ? "✓ Remote OK" : "Presencial"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Skills card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Skills requeridas</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Marca cuáles son obligatorias</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSkills((p) => [...p, { name: "", required: false }])}
                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                <div className="space-y-2.5">
                  <AnimatePresence>
                    {skills.map((s, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2.5 items-center"
                      >
                        <div className={`flex-1 flex items-center gap-2 rounded-xl border-2 px-3 py-2 transition-colors ${
                          s.required ? "border-violet-200 bg-violet-50/50" : "border-slate-200 bg-slate-50"
                        }`}>
                          <input
                            value={s.name}
                            onChange={(e) => updateSkill(i, "name", e.target.value)}
                            placeholder="ej. Python, React, SQL..."
                            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateSkill(i, "required", !s.required)}
                            className={`shrink-0 text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors cursor-pointer ${
                              s.required
                                ? "bg-violet-600 text-white"
                                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                            }`}
                          >
                            {s.required ? "Requerida" : "Opcional"}
                          </button>
                        </div>
                        {skills.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setSkills((p) => p.filter((_, idx) => idx !== i))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Competencies card */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Competencias</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Score mínimo que debe alcanzar el candidato</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCompetencies((p) => [...p, { name: "", minimum_score: 5 }])}
                    className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Plus size={12} /> Agregar
                  </button>
                </div>

                {/* Preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {COMPETENCY_PRESETS.filter(p => !competencies.find(c => c.name === p)).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setCompetencies((p) => [...p, { name: preset, minimum_score: 5 }])}
                      className="text-xs px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-violet-100 hover:text-violet-700 transition-colors cursor-pointer"
                    >
                      + {preset.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <AnimatePresence>
                    {competencies.map((c, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="flex gap-2.5 items-center"
                      >
                        <input
                          value={c.name}
                          onChange={(e) => updateCompetency(i, "name", e.target.value)}
                          placeholder="ej. problem_solving"
                          className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                        />
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                              <button
                                key={n}
                                type="button"
                                onClick={() => updateCompetency(i, "minimum_score", n)}
                                className={`w-5 h-5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                                  n <= c.minimum_score
                                    ? n <= 4 ? "bg-emerald-400 text-white" : n <= 7 ? "bg-amber-400 text-white" : "bg-red-400 text-white"
                                    : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                        {competencies.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCompetencies((p) => p.filter((_, idx) => idx !== i))}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>

              {/* Submit */}
              <motion.button
                type="submit"
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-violet-600 to-violet-800 text-white font-bold py-4 rounded-2xl shadow-sm hover:shadow-violet-200 hover:shadow-lg transition-all cursor-pointer disabled:opacity-60 text-sm"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creando cargo y buscando candidatos...
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Crear cargo
                    <ChevronRight size={16} className="ml-auto" />
                  </>
                )}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
