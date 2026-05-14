import Link from "next/link"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-8 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">OpenScout AI</span>
        <Link
          href="/login"
          className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Sign in
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-8 py-20 space-y-8 max-w-3xl mx-auto">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">
            Find the right talent,
            <br />
            <span className="text-muted-foreground">not just the right CV.</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            OpenScout normalizes every CV into a Universal Talent Language, scores candidates
            deterministically, and lets them interview asynchronously — all without bias or black boxes.
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/login"
            className="rounded-md bg-primary text-primary-foreground px-6 py-3 font-medium hover:bg-primary/90 transition-colors"
          >
            Get started
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-12 text-left w-full">
          {[
            {
              title: "UTL Normalization",
              desc: "Every CV — PDF, image, text — becomes a Universal Talent Language profile. No more inconsistent data.",
            },
            {
              title: "Explainable Scoring",
              desc: "5-dimension deterministic engine. Skills, experience, competencies, education, completeness. Every score has a reason.",
            },
            {
              title: "Async Interviews",
              desc: "AI selects the 6 most relevant questions for each job. Candidates answer on their schedule, no login required.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-border p-6 space-y-2">
              <h3 className="font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border px-8 py-4 text-center text-xs text-muted-foreground">
        OpenScout AI — Built for Fina + Platanus Hackathon 2025
      </footer>
    </div>
  )
}
