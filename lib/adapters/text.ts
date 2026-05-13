export function extractTextFromPlainText(input: string): string {
  return input.trim().replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n")
}
