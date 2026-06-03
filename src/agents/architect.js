const { appendMemory } = require('../memory');
const { validatePlanSchema, normalizePlan } = require('./architect-schema');
const { extractAndRepairJson } = require('../providers/json-repair');
const { KlawError } = require('../errors/klaw-error');

function validatePlan(plan) {
  const validation = validatePlanSchema(plan);

  if (!validation.valid) {
    throw new KlawError({
      code: 'VALIDATION_ERROR',
      provider: 'architect',
      stage: 'validation',
      message: `Invalid plan: ${validation.errors.join('; ')}`
    });
  }

  return normalizePlan(plan);
}

/**
 * A2.3: Classify architect error for retry decision
 * Uses explicit codes/status rather than generic text matching
 * @param {Error|KlawError} error - The error to classify
 * @returns {{retryable: boolean, reason: string}}
 */
function classifyArchitectError(error) {
  if (!error) {
    return { retryable: false, reason: 'unknown' };
  }

  const message = error.message || '';
  const code = error.code || '';

  // === NON-RETRYABLE: Explicit auth/billing failures by code ===
  if (code === 'MISSING_API_KEY' || code === 'PROVIDER_CONFIG_ERROR' || code === 'AUTH_ERROR') {
    return { retryable: false, reason: 'auth_failure' };
  }

  // === NON-RETRYABLE: HTTP status codes ===
  // 401 = unauthorized, 403 = forbidden
  if (/\b401\b/.test(message) || /\b403\b/.test(message)) {
    return { retryable: false, reason: 'auth_failure' };
  }

  // === NON-RETRYABLE: Explicit API key in error message ===
  // Only when referring to configuration, not validation fields
  if (/\b(OPENAI_API_KEY|ANTHROPIC_API_KEY|OPENROUTER_API_KEY|GEMINI_API_KEY|LANGDOCK_API_KEY)\b/.test(message)) {
    return { retryable: false, reason: 'auth_failure' };
  }

  // === NON-RETRYABLE: Billing/quota ===
  if (code === 'QUOTA_EXCEEDED' || code === 'BILLING_ERROR') {
    return { retryable: false, reason: 'quota_failure' };
  }
  if (/\b(quota|billing|insufficient credits)\b/i.test(message)) {
    return { retryable: false, reason: 'quota_failure' };
  }

  // === RETRYABLE: By error code ===
  if (code === 'VALIDATION_ERROR') {
    return { retryable: true, reason: 'validation_error' };
  }
  if (code === 'EMPTY_RESPONSE') {
    return { retryable: true, reason: 'empty_response' };
  }
  if (code === 'INVALID_JSON') {
    return { retryable: true, reason: 'invalid_json' };
  }

  // === RETRYABLE: Provider 5xx errors ===
  if (code === 'PROVIDER_ERROR') {
    if (/\b(429|500|502|503|504)\b/.test(message)) {
      return { retryable: true, reason: 'provider_5xx' };
    }
    return { retryable: true, reason: 'provider_error' };
  }

  // === RETRYABLE: By message patterns ===
  // Empty response
  if (/\bempty\b/i.test(message)) {
    return { retryable: true, reason: 'empty_response' };
  }

  // Default: don't retry unknown errors
  return { retryable: false, reason: 'unknown' };
}

class ArchitectAgent {
  constructor(provider, config = {}) {
    this.provider = provider;
    this.maxRetries = Math.min(config.architect?.retries ?? 1, 3);
    this.retryDelay = config.architect?.retryDelay ?? 1000;
  }

  async plan(task, context = {}) {
    console.log(`[KLAW][ARCHITECT] Planning: ${task}`);
    let rawResponse = await this.requestPlan(task, context);
    let lastError = null;
    let retriesAttempted = 0;
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      const repaired = this.parsePlanResponse(rawResponse);
      console.log(`[KLAW][ARCHITECT] JSON extraction: passes=${repaired.passes}, repaired=${repaired.repaired}`);

      try {
        return this.acceptPlan(repaired.result);
      } catch (error) {
        lastError = error;
        console.log(`[KLAW][ARCHITECT] Plan validation failed: ${error.message}`);

        const classification = classifyArchitectError(error);
        console.log(`[KLAW][ARCHITECT] Error classification: ${classification.reason}`);
        console.log(`[KLAW][ARCHITECT] Retry ${classification.retryable ? 'allowed' : 'skipped'}: ${classification.reason}`);

        // Not retryable: fail immediately with original error
        if (!classification.retryable) {
          throw error; // Re-throw original error, don't wrap
        }

        if (attempt < this.maxRetries) {
          retriesAttempted++;
          attempt++;
          console.log(`[KLAW][ARCHITECT] Retry ${attempt}/${this.maxRetries} after ${classification.reason}`);

          if (this.retryDelay > 0) {
            await new Promise(r => setTimeout(r, this.retryDelay));
          }

          rawResponse = await this.requestPlan(task, {
            ...context,
            planRepairError: error.message,
            previousPlan: repaired.result || rawResponse
          });
        } else {
          console.log(`[KLAW][ARCHITECT] Max retries (${this.maxRetries}) exhausted`);
        }
      }
    }

    // Only reach here if retries were attempted and exhausted
    throw new KlawError({
      code: 'MAX_RETRIES',
      provider: 'architect',
      stage: 'plan',
      message: `Plan failed after ${retriesAttempted} retry(s): ${lastError?.message || 'unknown error'}`
    });
  }

  async requestPlan(task, context = {}) {
    const repairPrompt = context.planRepairError
      ? [
          '',
          'The previous plan failed validation.',
          `Validation error: ${context.planRepairError}`,
          'Return one corrected JSON plan strictly following the required schema.'
        ].join('\n')
      : '';

    return this.provider.generateJson({
      system: [
        'You are KLAW ArchitectAgent.',
        'Return only JSON with this exact shape:',
        '{"summary":"...","projectType":"nextjs|node|static|cli|unknown","steps":[{"id":"step-1","agent":"writer|shell","title":"...","description":"...","task":"...","files":[],"commands":[]}]}',
        'Keep plans practical for a local CLI runtime.',
        'Include writer steps for files and shell steps for commands such as npm install or npm run dev when needed.'
      ].join('\n'),
      prompt: [
        `User task: ${task}`,
        `Workspace: ${context.workspace || ''}`,
        repairPrompt
      ].join('\n\n')
    });
  }

  parsePlanResponse(rawResponse) {
    if (rawResponse && typeof rawResponse === 'object') {
      return { result: rawResponse, repaired: false, passes: 1 };
    }

    return extractAndRepairJson(rawResponse, { provider: 'architect', stage: 'plan' });
  }

  acceptPlan(plan) {
    const normalized = validatePlan(plan);
    console.log(`[KLAW][ARCHITECT] ${normalized.summary}`);
    appendMemory('architect', `Planned ${normalized.steps.length} steps: ${normalized.summary}`);
    return normalized;
  }
}

module.exports = ArchitectAgent;
module.exports.validatePlan = validatePlan;
module.exports.classifyArchitectError = classifyArchitectError;