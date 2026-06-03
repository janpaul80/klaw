/**
 * JSON Repair Pipeline
 * Multi-pass extraction and repair for Provider JSON responses
 * Designed for reliability — handles malformed output gracefully
 */

const { KlawError } = require('../errors/klaw-error');

/**
 * Extract and repair JSON from provider response
 * @param {string} text - Raw provider response text
 * @param {Object} options - Repair options
 * @returns {{result: Object, repaired: boolean, passes: number}}
 */
function extractAndRepairJson(text, options = {}) {
  const trimmed = String(text || '').trim();
  const provider = options.provider || 'unknown';
  const passes = [];

  if (!trimmed) {
    return {
      result: null,
      repaired: false,
      passes: 0,
      error: 'EMPTY_RESPONSE'
    };
  }

  // Pass 1: Direct parse
  try {
    const parsed = JSON.parse(trimmed);
    passes.push('direct');
    return { result: parsed, repaired: false, passes: 1 };
  } catch (_) { /* continue */ }

  // Pass 2: Fenced code block
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      const parsed = JSON.parse(fencedMatch[1].trim());
      passes.push('fenced');
      return { result: parsed, repaired: true, passes: 2 };
    } catch (_) { /* continue */ }
  }

  // Pass 3: Find first { or [ and parse fragment
  const firstObject = trimmed.indexOf('{');
  const firstArray = trimmed.indexOf('[');
  const start = [firstObject, firstArray].filter((idx) => idx >= 0).sort((a, b) => a - b)[0];

  if (start !== undefined) {
    const end = trimmed[start] === '['
      ? trimmed.lastIndexOf(']')
      : trimmed.lastIndexOf('}');

    if (end > start) {
      try {
        const fragment = trimmed.slice(start, end + 1);
        const parsed = JSON.parse(fragment);
        passes.push('fragment');
        return { result: parsed, repaired: true, passes: 3 };
      } catch (_) { /* continue */ }
    }
  }

  // Pass 4: Aggressive repair — extract any JSON-like structure
  const jsonLikeMatches = trimmed.match(/\{[\s\S]*\}/g) || [];
  for (const match of jsonLikeMatches) {
    try {
      const parsed = JSON.parse(match);
      passes.push('aggressive');
      return { result: parsed, repaired: true, passes: 4 };
    } catch (_) { /* continue */ }
  }

  // All passes failed
  return {
    result: null,
    repaired: false,
    passes: passes.length,
    error: 'INVALID_JSON'
  };
}

/**
 * Repair a JSON response with retry context
 * @param {string} text - Raw provider response
 * @param {string} originalError - Error that triggered repair
 * @param {Object} options - Options with provider, stage info
 * @returns {Object} Repaired result or error
 */
function repairJsonResponse(text, originalError, options = {}) {
  const { result, repaired, passes, error } = extractAndRepairJson(text, options);

  if (result) {
    return {
      success: true,
      data: result,
      repaired,
      repairPasses: passes,
      metadata: {
        provider: options.provider || 'unknown',
        stage: options.stage || 'unknown',
        originalError,
        repairedVia: repaired ? 'json-repair' : 'none'
      }
    };
  }

  // Repair failed — wrap in KlawError
  throw new KlawError({
    code: error || 'JSON_REPAIR_FAILED',
    provider: options.provider || 'unknown',
    stage: options.stage || 'repair',
    message: `JSON repair failed after ${passes} passes: ${originalError}`
  });
}

/**
 * Check if JSON is valid for a specific schema
 * @param {Object} data - Data to check
 * @param {string} schemaType - Expected schema identifier
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateJsonSchema(data, schemaType) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Data is not a valid object'] };
  }

  switch (schemaType) {
    case 'architect-plan':
      if (!data.summary) errors.push('Missing summary');
      if (!data.steps || !Array.isArray(data.steps)) errors.push('Missing steps array');
      break;

    case 'writer-files':
      if (!Array.isArray(data)) errors.push('Expected array of files');
      data.forEach((file, i) => {
        if (!file.path) errors.push(`File ${i}: missing path`);
        if (!file.content) errors.push(`File ${i}: missing content`);
      });
      break;

    default:
      // No specific validation
      break;
  }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  extractAndRepairJson,
  repairJsonResponse,
  validateJsonSchema
};