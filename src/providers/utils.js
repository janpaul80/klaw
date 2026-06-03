/**
 * Provider Utilities
 * Shared JSON extraction and common helpers.
 * Lightweight implementation - comprehensive repair belongs in Phase A2.
 */

const { KlawError } = require('../errors/klaw-error');

/**
 * Extract JSON from provider text response.
 * Handles common formats: raw, fenced code blocks, partial fragments.
 */
function extractJson(text) {
  const trimmed = String(text || '').trim();

  if (!trimmed) {
    throw new KlawError({
      code: 'EMPTY_RESPONSE',
      provider: 'unknown',
      stage: 'extractJson',
      message: 'Provider returned an empty response'
    });
  }

  // Try direct parse first
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    // Try fenced code block
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) {
      try {
        return JSON.parse(fenced[1]);
      } catch (_) { /* fall through */ }
    }

    // Find first { or [
    const firstObject = trimmed.indexOf('{');
    const firstArray = trimmed.indexOf('[');
    const start = [firstObject, firstArray].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];

    if (start === undefined) {
      throw new KlawError({
        code: 'INVALID_JSON',
        provider: 'unknown',
        stage: 'extractJson',
        message: 'Provider response did not contain JSON'
      });
    }

    const end = trimmed[start] === '['
      ? trimmed.lastIndexOf(']')
      : trimmed.lastIndexOf('}');

    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch (e) {
      throw new KlawError({
        code: 'INVALID_JSON',
        provider: 'unknown',
        stage: 'extractJson',
        message: `Failed to parse JSON: ${e.message}`
      });
    }
  }
}

module.exports = { extractJson };