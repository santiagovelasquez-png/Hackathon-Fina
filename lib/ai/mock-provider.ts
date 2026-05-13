import type { AIProvider, SummarizeContext } from "./provider"
import type { AIExtractionOutput, InterviewEvaluation } from "@/lib/utl/schema"

/**
 * Mock AIProvider for development and tests.
 * Returns deterministic plausible data without any API calls.
 */
export const mockProvider: AIProvider = {
  async extractUTL(rawText: string): Promise<AIExtractionOutput> {
    // Derive basic signals from raw text length / keywords
    const hasEmail = /\b[\w.]+@[\w.]+\.[a-z]{2,}\b/i.test(rawText)
    const hasLinkedIn = /linkedin\.com/i.test(rawText)
    const hasPython = /python/i.test(rawText)
    const hasJS = /javascript|typescript|react|node/i.test(rawText)

    return {
      public: {
        location: {
          city: "Bogotá",
          country: "CO",
          remote: true,
          timezone: "America/Bogota",
        },
        total_experience_months: 36,
        current_title: "Software Engineer",
        experiences: [
          {
            company: "Acme Corp",
            title: "Software Engineer",
            start_date: "2022-01",
            end_date: null,
            duration_months: 28,
            description: "Built backend services and APIs",
            sector: "Technology",
          },
          {
            company: "Startup XYZ",
            title: "Junior Developer",
            start_date: "2020-06",
            end_date: "2021-12",
            duration_months: 18,
            description: "Frontend development",
            sector: "Fintech",
          },
        ],
        education: [
          {
            institution: "Universidad Nacional de Colombia",
            degree: "Bachelor",
            field: "Computer Science",
            start_date: "2016-01",
            end_date: "2020-06",
          },
        ],
        skills: [
          ...(hasPython
            ? [{ name: "python", category: "technical" as const, proficiency: "advanced" as const, years_of_experience: 3, source: "declared" as const }]
            : []),
          ...(hasJS
            ? [
                { name: "typescript", category: "technical" as const, proficiency: "intermediate" as const, years_of_experience: 2, source: "declared" as const },
                { name: "react", category: "technical" as const, proficiency: "intermediate" as const, years_of_experience: 2, source: "declared" as const },
              ]
            : []),
          { name: "postgresql", category: "tool" as const, proficiency: "intermediate" as const, years_of_experience: 2, source: "declared" as const },
        ],
        languages: [
          { code: "es", proficiency: "native" as const },
          { code: "en", proficiency: "B2" as const },
        ],
        competency_evidence: [
          {
            competency_name: "problem_solving",
            evidence_text: "Reduced API latency by 40% through caching optimization",
            evidence_source: "cv_text" as const,
            confidence_score: 0.75,
            explanation: "Demonstrates technical problem solving with measurable impact",
            competency_score: null,
          },
        ],
        interview_answers: [],
        confidence_score: 0.65,
        flags: [],
      },
      private: {
        full_name: "Demo Candidate",
        email: hasEmail ? "demo@example.com" : null,
        phone: "+57 300 000 0000",
        linkedin_url: hasLinkedIn ? "https://linkedin.com/in/demo" : null,
        portfolio_url: null,
      },
    }
  },

  async evaluateAnswer({ question, answer, competency_name, rubric }): Promise<
    Pick<InterviewEvaluation, "proposed_score" | "explanation" | "rubric_applied">
  > {
    // Mock: score based on answer length as a proxy for detail
    const wordCount = answer.split(/\s+/).length
    const proposed_score = Math.min(10, Math.max(1, Math.round(wordCount / 10)))

    return {
      proposed_score,
      explanation: `[MOCK] Answer has ${wordCount} words. Demonstrates ${competency_name} with ${proposed_score >= 7 ? "strong" : "partial"} evidence.`,
      rubric_applied: rubric,
    }
  },

  async summarize(ctx: SummarizeContext): Promise<string> {
    const { candidate_title, total_experience_months, top_skills, job_title } = ctx
    const years = Math.floor(total_experience_months / 12)
    const skills = top_skills.slice(0, 3).join(", ")

    return `[MOCK] This candidate brings ${years} years of experience as ${candidate_title ?? "a professional"} with demonstrated skills in ${skills}. Based on the evaluation criteria for ${job_title}, they represent a strong match for technical requirements and show potential for growth in the role.`
  },
}
