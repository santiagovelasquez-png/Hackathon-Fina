import { ZodError } from "zod"
import {
  PublicUTLSchema,
  PrivateUTLSchema,
  AIExtractionOutputSchema,
  type PublicUTL,
  type PrivateUTL,
  type AIExtractionOutput,
} from "./schema"

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: ValidationError[] }

export interface ValidationError {
  path: string
  message: string
}

function formatZodError(err: ZodError): ValidationError[] {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}

export function validatePublicUTL(data: unknown): ValidationResult<PublicUTL> {
  const result = PublicUTLSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, errors: formatZodError(result.error) }
}

export function validatePrivateUTL(data: unknown): ValidationResult<PrivateUTL> {
  const result = PrivateUTLSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, errors: formatZodError(result.error) }
}

export function validateAIExtractionOutput(
  data: unknown
): ValidationResult<AIExtractionOutput> {
  const result = AIExtractionOutputSchema.safeParse(data)
  if (result.success) return { success: true, data: result.data }
  return { success: false, errors: formatZodError(result.error) }
}
