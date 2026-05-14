"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"

interface IngestResult {
  candidate_id: string
  confidence_score: number
  flags: Array<{ field: string; reason: string; severity: string }>
  preview: {
    name: string
    title: string | null
    experience_months: number
    skills: string[]
  }
}

interface Job {
  id: string
  utl_job_profile: { title: string }
}

export default function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [scoring, setScoring] = useState(false)
  const [result, setResult] = useState<IngestResult | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [selectedJobId, setSelectedJobId] = useState("")
  const [scoreDone, setScoreDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith(".pdf")) {
      setError("Only PDF files are supported")
      return
    }
    setError(null)
    setResult(null)
    setScoreDone(false)
    setUploading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("/api/ingest/pdf", { method: "POST", body: formData })
    const data = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(data.error ?? "Upload failed")
      return
    }

    setResult(data)

    // Load jobs for scoring
    const jobsRes = await fetch("/api/jobs")
    const jobsData = await jobsRes.json()
    setJobs(jobsData.jobs ?? [])
  }

  async function handleScore() {
    if (!result || !selectedJobId) return
    setScoring(true)

    const res = await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: result.candidate_id, job_id: selectedJobId }),
    })

    setScoring(false)
    if (res.ok) {
      setScoreDone(true)
    } else {
      const d = await res.json()
      setError(d.error ?? "Scoring failed")
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Upload CV</h1>

      {/* Dropzone */}
      <div
        className={`rounded-xl border-2 border-dashed transition-colors p-12 text-center cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
        <p className="text-muted-foreground text-sm">
          {uploading ? "Processing..." : "Drop a PDF here or click to select"}
        </p>
      </div>

      {uploading && <Progress value={null} className="h-1" />}

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-border p-6 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold text-lg">{result.preview.name}</p>
              <p className="text-sm text-muted-foreground">{result.preview.title ?? "No title found"}</p>
            </div>
            <Badge variant={result.confidence_score > 0.6 ? "default" : "secondary"}>
              {Math.round(result.confidence_score * 100)}% confidence
            </Badge>
          </div>

          <div className="text-sm space-y-1">
            <p><span className="text-muted-foreground">Experience:</span> {result.preview.experience_months} months</p>
            <p>
              <span className="text-muted-foreground">Skills:</span>{" "}
              {result.preview.skills.length > 0
                ? result.preview.skills.join(", ")
                : "None detected"}
            </p>
          </div>

          {result.flags.length > 0 && (
            <div className="space-y-1">
              {result.flags.map((f, i) => (
                <p key={i} className={`text-xs ${f.severity === "error" ? "text-destructive" : "text-yellow-600 dark:text-yellow-400"}`}>
                  ⚠ {f.field}: {f.reason}
                </p>
              ))}
            </div>
          )}

          {/* Add to job */}
          {!scoreDone ? (
            <div className="pt-2 space-y-3 border-t border-border">
              <p className="text-sm font-medium">Add to a job ranking</p>
              <div className="flex gap-2">
                <select
                  value={selectedJobId}
                  onChange={(e) => setSelectedJobId(e.target.value)}
                  className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                >
                  <option value="">Select a job...</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>{j.utl_job_profile.title}</option>
                  ))}
                </select>
                <Button onClick={handleScore} disabled={!selectedJobId || scoring}>
                  {scoring ? "Scoring..." : "Score & rank"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-2 border-t border-border flex items-center gap-3">
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">✓ Added to ranking</p>
              <a href={`/ranking/${selectedJobId}`} className="text-sm underline text-muted-foreground hover:text-foreground">
                View ranking →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
