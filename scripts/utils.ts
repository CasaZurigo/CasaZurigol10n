export function normalizeString(text: string): string {
  return text
    .replace(/\r\n|\r|\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n");
}
