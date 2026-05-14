"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  candidateId: string
  jobId: string
}

export function InviteButton({ candidateId, jobId }: Props) {
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleInvite() {
    setLoading(true)
    setError(null)

    const res = await fetch("/api/interview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidate_id: candidateId, job_id: jobId }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to create interview")
      return
    }

    try {
      await navigator.clipboard.writeText(data.interview_url)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback for non-HTTPS environments
      window.prompt("Copy interview link:", data.interview_url)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="outline"
        onClick={handleInvite}
        disabled={loading || copied}
      >
        {loading ? "Creating..." : copied ? "✓ Link copied!" : "Invite to interview"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
