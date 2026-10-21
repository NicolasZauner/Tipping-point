// Source-passage check (docs/ai-contracts.md): a passage Claude cites must appear in the pasted
// text, after collapsing whitespace and normalising quotes, dashes and compatibility characters.

const MIN_LENGTH = 8;

export function normalisePassage(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function passageValid(passage: string, source: string): boolean {
  const p = normalisePassage(passage);
  return p.length >= MIN_LENGTH && normalisePassage(source).includes(p);
}
