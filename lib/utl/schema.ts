import { z } from "zod"

// ── Primitives ────────────────────────────────────────────────────────────────

export const LocationSchema = z.object({
  city: z.string().nullable(),
  country: z.string().length(2).nullable(), // ISO 3166-1 alpha-2
  remote: z.boolean(),
  timezone: z.string().nullable(), // IANA tz
})

export const ExperienceSchema = z.object({
  company: z.string(),
  title: z.string(),
  start_date: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
  end_date: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM").nullable(), // null = current
  duration_months: z.number().int().nonnegative(),
  description: z.string().nullable(),
  sector: z.string().nullable(),
})

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string().nullable(),
  field: z.string().nullable(),
  start_date: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  end_date: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
})

export const SkillSchema = z.object({
  name: z.string(), // canonical — always lowercase, normalized via skill-taxonomy
  category: z.enum(["technical", "tool", "soft", "domain"]),
  proficiency: z.enum(["beginner", "intermediate", "advanced", "expert"]).nullable(),
  years_of_experience: z.number().nonnegative().nullable(),
  source: z.enum(["declared", "inferred"]),
})

export const LanguageSchema = z.object({
  code: z.string().length(2), // ISO 639-1
  proficiency: z.enum(["A1", "A2", "B1", "B2", "C1", "C2", "native"]),
})

// AI extracts evidence — engine calculates competency_score
export const CompetencyEvidenceSchema = z.object({
  competency_name: z.string(),
  evidence_text: z.string(), // exact quote from source
  evidence_source: z.enum(["cv_text", "interview_answer", "linkedin"]),
  confidence_score: z.number().min(0).max(1),
  explanation: z.string(), // why this evidence supports the competency
  competency_score: z.number().min(1).max(10).nullable(), // set by scoring engine, not AI
})

export const FlagSchema = z.object({
  field: z.string(),
  reason: z.string(),
  severity: z.enum(["warning", "error"]),
})

export const InterviewAnswerSchema = z.object({
  question_id: z.string(),
  question_text: z.string(),
  answer_text: z.string(),
  answered_at: z.string().datetime(),
  parsed_into_utl: z.boolean(),
})

// ── Public UTL Record (stored in candidates.public_utl — NO PII) ──────────────

export const PublicUTLSchema = z.object({
  location: LocationSchema,
  total_experience_months: z.number().int().nonnegative(),
  current_title: z.string().nullable(),
  experiences: z.array(ExperienceSchema),
  education: z.array(EducationSchema),
  skills: z.array(SkillSchema),
  languages: z.array(LanguageSchema),
  competency_evidence: z.array(CompetencyEvidenceSchema),
  interview_answers: z.array(InterviewAnswerSchema),
  confidence_score: z.number().min(0).max(1),
  flags: z.array(FlagSchema),
})

// ── Private data (stored in candidate_private_data — PII only) ───────────────

export const PrivateUTLSchema = z.object({
  full_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  linkedin_url: z.string().url().nullable(),
  portfolio_url: z.string().url().nullable(),
})

// ── AI Extraction Output (draft — must pass PublicUTLSchema + PrivateUTLSchema) ─

export const AIExtractionOutputSchema = z.object({
  public: PublicUTLSchema.partial().extend({
    // These are always required even in partial
    location: LocationSchema.partial().extend({ remote: z.boolean() }),
    experiences: z.array(ExperienceSchema).default([]),
    education: z.array(EducationSchema).default([]),
    skills: z.array(SkillSchema).default([]),
    languages: z.array(LanguageSchema).default([]),
    competency_evidence: z.array(CompetencyEvidenceSchema).default([]),
    interview_answers: z.array(InterviewAnswerSchema).default([]),
    flags: z.array(FlagSchema).default([]),
  }),
  private: PrivateUTLSchema.partial(),
})

// ── Job Profile (UTLJobProfile) ───────────────────────────────────────────────

export const RequiredSkillSchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  required: z.boolean(),
})

export const JobCompetencySchema = z.object({
  name: z.string(),
  weight: z.number().min(0).max(1),
  minimum_score: z.number().min(1).max(10),
})

export const SalaryRangeSchema = z.object({
  min: z.number().nonnegative(),
  max: z.number().nonnegative(),
  currency: z.string().length(3), // ISO 4217
})

export const UTLJobProfileSchema = z.object({
  title: z.string(),
  description: z.string(),
  required_skills: z.array(RequiredSkillSchema),
  competencies: z.array(JobCompetencySchema),
  min_experience_months: z.number().int().nonnegative(),
  location: z.object({
    country: z.string().length(2).nullable(),
    remote_ok: z.boolean(),
  }),
  salary_range: SalaryRangeSchema.nullable(),
  salary_is_hard_filter: z.boolean().default(false),
  status: z.enum(["draft", "active", "closed"]),
})

// ── Scoring ───────────────────────────────────────────────────────────────────

export const ScoreDimensionSchema = z.object({
  dimension: z.enum([
    "skills_match",
    "experience",
    "competencies",
    "education",
    "completeness",
  ]),
  score: z.number().min(1).max(10),
  weight: z.number().min(0).max(1),
  explanation: z.string(),
  rules_fired: z.array(z.string()),
})

export const CandidateScoreSchema = z.object({
  total_score: z.number().min(1).max(10),
  breakdown: z.array(ScoreDimensionSchema),
  exclusion_reason: z.string().nullable(),
  engine_version: z.string(),
  computed_at: z.string().datetime(),
})

// ── Interview Evaluation (AI proposes, engine confirms) ───────────────────────

export const InterviewEvaluationSchema = z.object({
  question_id: z.string(),
  answer_text: z.string(),
  competency_name: z.string(),
  proposed_score: z.number().min(1).max(10), // AI proposes with fixed rubric
  final_score: z.number().min(1).max(10).nullable(), // engine confirms
  explanation: z.string(),
  rubric_applied: z.string(),
})

// ── Profile summary (redacted — what companies see in ranking by default) ─────

export const ProfileSummarySchema = z.object({
  current_title: z.string().nullable(),
  total_experience_months: z.number().int().nonnegative(),
  top_skills: z.array(z.string()).max(5),
  location_summary: z.string().nullable(), // e.g. "Colombia · Remote OK"
  languages: z.array(z.string()),
  confidence_score: z.number().min(0).max(1),
})

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type PublicUTL = z.infer<typeof PublicUTLSchema>
export type PrivateUTL = z.infer<typeof PrivateUTLSchema>
export type AIExtractionOutput = z.infer<typeof AIExtractionOutputSchema>
export type UTLJobProfile = z.infer<typeof UTLJobProfileSchema>
export type CandidateScore = z.infer<typeof CandidateScoreSchema>
export type ScoreDimension = z.infer<typeof ScoreDimensionSchema>
export type InterviewEvaluation = z.infer<typeof InterviewEvaluationSchema>
export type ProfileSummary = z.infer<typeof ProfileSummarySchema>
export type CompetencyEvidence = z.infer<typeof CompetencyEvidenceSchema>
export type Skill = z.infer<typeof SkillSchema>
export type Experience = z.infer<typeof ExperienceSchema>
export type Education = z.infer<typeof EducationSchema>
export type Language = z.infer<typeof LanguageSchema>
export type UTLFlag = z.infer<typeof FlagSchema>
export type UTLLocation = z.infer<typeof LocationSchema>
