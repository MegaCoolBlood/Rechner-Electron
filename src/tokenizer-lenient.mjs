// Lenient tokenizer for number-like substrings used by formatting
// Allows spaces in integer part and optional comma fractional part

const NUMBER_REGEX = /-?\d[\d\s]*(?:,\d*)?/g;

export function findNumberTokens(value) {
  const tokens = [];
  let match;
  while ((match = NUMBER_REGEX.exec(value)) !== null) {
    tokens.push({ start: match.index, end: match.index + match[0].length, raw: match[0] });
  }
  return tokens;
}
