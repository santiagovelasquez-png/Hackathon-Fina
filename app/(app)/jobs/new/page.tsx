"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

interface Skill { name: string; weight: number; required: boolean }
interface Competency { name: string; weight: number; minimum_score: number }

export default function NewJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [minExperience, setMinExperience] = useState(12)
  const [remoteOk, setRemoteOk] = useState(true)
  const [skills, setSkills] = useState<Skill[]>([
    { name: "", weight: 0.4, required: true },
    { name: "", weight: 0.3, required: true },
    { name: "", weight: 0.3, required: false },
  ])
  const [competencies, setCompetencies] = useState<Competency[]>([
    { name: "problem_solving", weight: 0.5, minimum_score: 6 },
    { name: "collaboration", weight: 0.5, minimum_score: 5 },
  ])

  function updateSkill(i: number, field: keyof Skill, value: string | number | boolean) {
    setSkills((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))
  }
  function addSkill() {
    setSkills((prev) => [...prev, { name: "", weight: 0.2, required: false }])
  }
  function removeSkill(i: number) {
    setSkills((prev) => prev.filter((_, idx) => idx !== i))
  }
  function updateCompetency(i: number, field: keyof Competency, value: string | number) {
    setCompetencies((prev) => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  }
  function addCompetency() {
    setCompetencies((prev) => [...prev, { name: "", weight: 0.3, minimum_score: 5 }])
  }
  function removeCompetency(i: number) {
    setCompetencies((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const filteredSkills = skills.filter((s) => s.name.trim())
    const filteredCompetencies = competencies.filter((c) => c.name.trim())

    const res = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        required_skills: filteredSkills,
        competencies: filteredCompetencies,
        min_experience_months: minExperience,
        location: { country: null, remote_ok: remoteOk },
      }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to create job")
      return
    }

    router.push(`/ranking/${data.job_id}`)
  }

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <h1 className="text-2xl font-bold">New job</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Job title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Backend Engineer" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What does this role involve?" required />
          </div>
          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label htmlFor="exp">Min experience (months)</Label>
              <Input id="exp" type="number" min={0} value={minExperience} onChange={(e) => setMinExperience(Number(e.target.value))} />
            </div>
            <div className="space-y-2 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={remoteOk} onChange={(e) => setRemoteOk(e.target.checked)} className="rounded" />
                <span className="text-sm">Remote OK</span>
              </label>
            </div>
          </div>
        </div>

        {/* Skills */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Required skills</Label>
            <button type="button" onClick={addSkill} className="text-xs text-muted-foreground hover:text-foreground underline">+ add skill</button>
          </div>
          {skills.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={s.name} onChange={(e) => updateSkill(i, "name", e.target.value)} placeholder="e.g. Python" className="flex-1" />
              <input type="number" step="0.1" min="0" max="1" value={s.weight} onChange={(e) => updateSkill(i, "weight", parseFloat(e.target.value))} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" />
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <input type="checkbox" checked={s.required} onChange={(e) => updateSkill(i, "required", e.target.checked)} />
                required
              </label>
              {skills.length > 1 && (
                <button type="button" onClick={() => removeSkill(i)} className="text-destructive text-xs hover:underline">✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Competencies */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Competencies</Label>
            <button type="button" onClick={addCompetency} className="text-xs text-muted-foreground hover:text-foreground underline">+ add</button>
          </div>
          {competencies.map((c, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Input value={c.name} onChange={(e) => updateCompetency(i, "name", e.target.value)} placeholder="e.g. problem_solving" className="flex-1" />
              <input type="number" step="0.1" min="0" max="1" value={c.weight} onChange={(e) => updateCompetency(i, "weight", parseFloat(e.target.value))} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" title="weight" />
              <input type="number" min="1" max="10" value={c.minimum_score} onChange={(e) => updateCompetency(i, "minimum_score", parseInt(e.target.value))} className="w-16 rounded-md border border-input bg-background px-2 py-1 text-sm" title="min score" />
              {competencies.length > 1 && (
                <button type="button" onClick={() => removeCompetency(i)} className="text-destructive text-xs hover:underline">✕</button>
              )}
            </div>
          ))}
          <p className="text-xs text-muted-foreground">Columns: name · weight (0-1) · min score (1-10)</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create job"}
        </Button>
      </form>
    </div>
  )
}
