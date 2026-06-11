const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_TOKENS = 768;
const DEFAULT_OVERLAP_TOKENS = 128;

export function chunkText(
  text: string,
  maxTokens = DEFAULT_MAX_TOKENS,
  overlapTokens = DEFAULT_OVERLAP_TOKENS,
): string[] {
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;

  if (text.length <= maxChars) {
    return [text];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxChars;
    if (end >= text.length) {
      chunks.push(text.slice(start));
      break;
    }

    const boundary = findBoundary(text, end);
    chunks.push(text.slice(start, boundary));
    start = boundary - overlapChars;
    if (start < 0) start = 0;
  }

  return chunks;
}

function findBoundary(text: string, fromIndex: number): number {
  const paragraphBoundary = text.lastIndexOf('\n\n', fromIndex);
  if (paragraphBoundary > fromIndex - 200) return paragraphBoundary + 2;

  const sentenceEnd = Math.max(
    text.lastIndexOf('. ', fromIndex),
    text.lastIndexOf('!\n', fromIndex),
    text.lastIndexOf('?\n', fromIndex),
    text.lastIndexOf('.\n', fromIndex),
  );
  if (sentenceEnd > fromIndex - 100) return sentenceEnd + 1;

  const wordBoundary = text.lastIndexOf(' ', fromIndex);
  if (wordBoundary > fromIndex - 50) return wordBoundary + 1;

  return fromIndex;
}
