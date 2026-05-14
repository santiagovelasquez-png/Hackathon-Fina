"use client"

import { useState, useRef } from "react"
import { Upload, FileText, CheckCircle, Loader2, AlertCircle, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

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
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    setLoading(true)
    setError(null)
    setPreview(null)
    setFileName(file.name)

    const fd = new FormData()
    fd.append("file", file)

    try {
      const res = await fetch("/api/talent/cv", { method: "POST", body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Error procesando CV")
      setPreview(data.preview)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const file = files[0]
    if (file.type !== "application/pdf") {
      setError("Solo se aceptan archivos PDF")
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
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
          onClick={() => !loading && inputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer
            ${dragging ? "border-violet-400 bg-violet-50" : "border-slate-200 bg-white hover:border-violet-300 hover:bg-violet-50/30"}
            ${loading ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
              {loading ? <Loader2 size={28} className="text-violet-500 animate-spin" /> : <Upload size={28} className="text-violet-500" />}
            </div>
            <div>
              <p className="font-semibold text-slate-800">
                {loading ? "Procesando tu CV..." : "Arrastra tu CV aquí"}
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
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-violet-600 to-violet-800 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <FileText size={22} className="text-white" />
                </div>
                <div>
                  <p className="font-bold text-white text-lg">{preview.name}</p>
                  <p className="text-violet-200 text-sm">{preview.title ?? "Profesional"}</p>
                </div>
                <div className="ml-auto">
                  <CheckCircle size={24} className="text-emerald-400" />
                </div>
              </div>
            </div>

            {/* Body */}
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
                  {preview.skills.map((s) => (
                    <span key={s} className="text-xs bg-violet-50 text-violet-700 px-2.5 py-1 rounded-lg font-mono border border-violet-200">{s}</span>
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
          </div>
        )}

        {fileName && !loading && !preview && !error && (
          <p className="text-xs text-slate-400 text-center">Archivo: {fileName}</p>
        )}
      </div>
    </div>
  )
}
