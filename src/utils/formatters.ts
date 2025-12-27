/**
 * Formatting Utilities
 *
 * Consistent formatting for time, percentages, and numbers.
 *
 * Laws of UX Applied:
 * - Law of Prägnanz: Simple, easy to parse formats
 */

/**
 * Format milliseconds into human-readable duration
 * Examples: "3h 24m", "45m", "<1m"
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return 'Ready';

  const totalMins = Math.ceil(ms / 60000);
  if (totalMins < 1) return '<1m';
  if (totalMins < 60) return `${totalMins}m`;

  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;

  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * Format future date relative to now
 * Examples: "in 2h", "tomorrow", "just now"
 */
export function formatRelativeTime(date: Date): string {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'now';
  return `in ${formatDuration(diff)}`;
}

/**
 * Format percentage with optional suffix
 */
export function formatPercent(value: number, suffix = '%'): string {
  return `${Math.round(value)}${suffix}`;
}

/**
 * Shorten model names for compact displays
 * Examples: "Claude Sonnet 3.5" -> "Claude 3.5"
 */
export function formatModelName(name: string, lengths: 'short' | 'medium' | 'full' = 'full'): string {
  if (lengths === 'full') return name;

  // Clean up common prefixes
  let clean = name
    .replace(/^codeium/i, '')
    .replace(/^antigravity/i, '')
    .trim();

  // Handle specific well-known models
  if (clean.includes('Claude')) {
    const match = clean.match(/Claude\s.*?(\d+(\.\d+)?)/i);
    if (match) return `Claude ${match[1]}`;
    return 'Claude';
  }

  if (clean.includes('GPT')) {
    const match = clean.match(/GPT.*?(\d+)/i);
    if (match) return `GPT-${match[1]}`;
    return 'GPT';
  }

  if (clean.includes('Gemini')) {
    if (clean.includes('Pro')) return 'Gemini Pro';
    if (clean.includes('Flash')) return 'Gemini Flash';
    return 'Gemini';
  }

  // Fallback truncation
  const maxLength = lengths === 'short' ? 10 : 20;
  if (clean.length > maxLength) {
    return clean.substring(0, maxLength - 1) + '…';
  }

  return clean;
}
