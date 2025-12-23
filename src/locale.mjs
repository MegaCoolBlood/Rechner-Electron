// Locale & numeric formatting constants

/** Non-breaking space used as thousands separator */
export const NBSP = '\u00A0';

export function groupSeparator() {
  return NBSP;
}

export function decimalSeparator() {
  return ',';
}

export function normalizeNumericInput(raw) {
  // Remove all whitespace (incl. NBSP) and use dot for decimals
  return raw.replace(/\s+/g, '').replace(/,/g, '.');
}
