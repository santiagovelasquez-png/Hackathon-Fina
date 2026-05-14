"use client"

import { useState, useRef } from "react"
import { Upload, FileText, CheckCircle, Loader2, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

interface Preview {
  name: string
  title: string | null
  experience_months: number
  skills: string[]
  confidence_score: number
}

export default function TalentCVPage() {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setLoading(true)
    setPreview(null)

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch("/api/talent/cv", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error procesando CV")
      setPreview(data.preview)
      toast.success("CV procesado correctamente", { description: "La IA ya está buscando oportunidades para ti." })
    } catch (e) {
      toast.error("Error procesando CV", { description: e instanceof Error ? e.message : "Error desconocido" })
    } finally {
      setLoading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.type !== "application/pdf") {
      toast.error("Formato inválido", { description: "Solo se aceptan archivos PDF." })
      return
    }
    upload(file)
  }

  return (
    <div className="min-h-full bg-[#F8FAFC]">
      <div className="bg-white border-b border-slate-200 px-8 py-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-900">Mi CV</h1>
          <p className="text-sm text-slate-500 mt-0.5">La IA analiza tu CV y lo convierte en un perfil estructurado para conectarte con oportunidades.</p>
        </div>
      </div>

      <div className="px-8 py-8 max-w-2xl space-y-6">
        {/* Dropzone */}
        <motion.div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => !loading && inputRef.current?.click()}
          animate={{ borderColor: dragging ? "#8b5cf6" : "#e2e8f0", backgroundColor: dragging ? "#f5f3ff" : "#ffffff" }}
          className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer
            ${loading ? "pointer-events-none opacity-60" : "hover:border-violet-300 hover:bg-violet-50/30"}`}
        >
          <input ref={inputRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ scale: dragging ? 1.12 : 1 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center"
            >
              {loading
                ? <Loader2 size={28} className="text-violet-500 animate-spin" />
                : <Upload size={28} className="text-violet-500" />}
            </motion.div>
            <div>
              <p className="font-semibold text-slate-800">
                {loading ? "Procesando tu CV..." : dragging ? "Suelta para analizar" : "Arrastra tu CV aquí"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {loading ? "La IA está extrayendo tu información" : "o haz clic para seleccionar un PDF"}
              </p>
            </div>
            {!loading && (
              <Button variant="outline" className="rounded-xl cursor-pointer" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
                Seleccionar PDF
              </Button>
            )}
          </div>
        </motion.div>

        {/* Preview */}
        <AnimatePresence>
          {preview && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                    <FileText size={22} className="text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-lg">{preview.name}</p>
                    <p className="text-violet-200 text-sm">{preview.title ?? "Profesional"}</p>
                  </div>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 400 }}
                    className="ml-auto"
                  >
                    <CheckCircle size={24} className="text-emerald-400" />
                  </motion.div>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Experiencia</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {preview.experience_months >= 12
                        ? `${Math.round(preview.experience_months / 12)} año${Math.round(preview.experience_months / 12) !== 1 ? "s" : ""}`
                        : `${preview.experience_months} meses`}
                    </p>
                  </div>
                  <div className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-1">Confianza IA</p>
                    <p className="text-2xl font-bold text-slate-900">{Math.round(preview.confidence_score * 100)}%</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wide mb-2">Skills detectadas</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.skills.map((s, i) => (
                      <motion.span
                        key={s}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 + i * 0.05 }}
                        className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg font-mono border border-violet-200"
                      >
                        {s}
                      </motion.span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                  <Zap size={16} className="text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-700 font-medium">
                    Tu perfil está listo. La IA ya está buscando oportunidades que coincidan contigo.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
