"use client"

import { useState, useEffect, use } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"

interface SessionState {
  status: string
  current_question_index: number
  total_questions: number
  current_question: { id: string; text: string; competency: string } | null
  next_question: { id: string; text: string; competency: string } | null
  job_title: string
  completed: boolean
  evaluation?: { score: number; explanation: string }
}

export default function InterviewPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [session, setSession] = useState<SessionState | null>(null)
  const [answer, setAnswer] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [lastEval, setLastEval] = useState<{ score: number; explanation: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setError("Missing access token")
      setLoading(false)
      return
    }

    fetch(`/api/interview/${sessionId}?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setSession(data)
      })
      .catch(() => setError("Failed to load interview"))
      .finally(() => setLoading(false))
  }, [sessionId, token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!answer.trim() || !token) return

    setSubmitting(true)
    setLastEval(null)

    const res = await fetch(`/api/interview/${sessionId}?token=${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer_text: answer }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(data.error ?? "Failed to submit answer")
      return
    }

    setAnswer("")
    setLastEval(data.evaluation ?? null)

    setSession((prev) =>
      prev
        ? {
            ...prev,
            status: data.status,
            current_question_index: data.current_question_index,
            current_question: data.next_question,
            completed: data.completed,
          }
        : prev
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading interview...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-3">
          <p className="text-xl font-bold">Access denied</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground">This link may have expired. Contact the recruiter for a new one.</p>
        </div>
      </div>
    )
  }

  if (!session) return null

  if (session.completed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-sm text-center space-y-4">
          <div className="text-4xl">✓</div>
          <h1 className="text-xl font-bold">Interview completed</h1>
          <p className="text-sm text-muted-foreground">
            Thank you for completing the interview for <strong>{session.job_title}</strong>.
            Your responses have been submitted and the recruiter will be in touch.
          </p>
        </div>
      </div>
    )
  }

  const progress = session.total_questions > 0
    ? (session.current_question_index / session.total_questions) * 100
    : 0

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Interview — {session.job_title}</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Question {session.current_question_index + 1} of {session.total_questions}
        </p>
      </div>

      <Progress value={progress} className="h-0.5 rounded-none" />

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        {/* Question */}
        {session.current_question && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {session.current_question.competency.replace(/_/g, " ")}
            </p>
            <h2 className="text-xl font-medium leading-snug">{session.current_question.text}</h2>
          </div>
        )}

        {/* Last evaluation feedback */}
        {lastEval && (
          <div className="rounded-lg bg-muted/40 border border-border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">Previous answer evaluated</p>
            <p className="text-sm">{lastEval.explanation}</p>
          </div>
        )}

        {/* Answer form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here... Be specific and give examples when possible."
            rows={6}
            className="resize-none"
            required
            minLength={20}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Minimum 20 characters. Be specific — examples help.</p>
            <Button type="submit" disabled={submitting || answer.trim().length < 20}>
              {submitting ? "Evaluating..." : session.current_question_index + 1 === session.total_questions ? "Finish" : "Next question"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
