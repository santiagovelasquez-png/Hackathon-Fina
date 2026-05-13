/**
 * Parses a date string to a Date at the first of that month.
 * Accepts: YYYY-MM, YYYY-MM-DD, YYYY, or any Date-parseable string.
 */
export function parseToYearMonth(input: string | Date): Date {
  if (input instanceof Date) return startOfMonth(input)

  const yearMonthMatch = input.match(/^(\d{4})-(\d{2})/)
  if (yearMonthMatch) {
    return new Date(parseInt(yearMonthMatch[1]), parseInt(yearMonthMatch[2]) - 1, 1)
  }

  const yearOnlyMatch = input.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    return new Date(parseInt(yearOnlyMatch[1]), 0, 1)
  }

  const parsed = new Date(input)
  if (!isNaN(parsed.getTime())) return startOfMonth(parsed)

  throw new Error(`Cannot parse date: "${input}"`)
}

export function diffMonths(from: Date, to: Date): number {
  const yearDiff = to.getFullYear() - from.getFullYear()
  const monthDiff = to.getMonth() - from.getMonth()
  return yearDiff * 12 + monthDiff
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function toYearMonthString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}
