export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse")
  const parser = new PDFParse({})
  // load() parses the PDF; getText() returns extracted text
  await (parser as unknown as { load(b: Buffer): Promise<void> }).load(buffer)
  const result = await (parser.getText() as unknown as Promise<{ text?: string } | string>)
  const text = typeof result === "string" ? result : (result as { text?: string }).text ?? ""
  return text.trim()
}
