// Used when all adapters fail — caller collects manual form data instead
export type ManualEntryFields = {
  full_name: string
  email: string
  current_title: string
  total_experience_years: number
  skills: string[]
  summary: string
}

export function manualEntryToRawText(fields: ManualEntryFields): string {
  return [
    `Name: ${fields.full_name}`,
    `Email: ${fields.email}`,
    `Current Title: ${fields.current_title}`,
    `Years of Experience: ${fields.total_experience_years}`,
    `Skills: ${fields.skills.join(", ")}`,
    `Summary: ${fields.summary}`,
  ].join("\n")
}
