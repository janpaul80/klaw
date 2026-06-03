const { appendMemory } = require('../memory');
const { validatePlanSchema, normalizePlan } = require('./architect-schema');
const { extractAndRepairJson } = require('../providers/json-repair');
const { KlawError } = require('../errors/klaw-error');

function validatePlan(plan) {
  // A2.1: Use strict schema validation (source of truth)
  const validation = validatePlanSchema(plan);

  if (!validation.valid) {
    throw new KlawError({
      code: 'VALIDATION_ERROR',
      provider: 'architect',
      stage: 'validation',
      message: `Invalid plan: ${validation.errors.join('; ')}`
    });
  }

  // Normalize valid plan
  return normalizePlan(plan);
}

class ArchitectAgent {
  constructor(provider) {
    this.provider = provider;
  }

  async plan(task, context = {}) {
    console.log(`[KLAW][ARCHITECT] Planning: ${task}`);
    const rawResponse = await this.requestPlan(task, context);
    const repaired = extractAndRepairJson(rawResponse);

    // A2.2: Log confidence metadata
    console.log(`[KLAW][ARCHITECT] JSON extraction: passes=${repaired.passes}, repaired=${repaired.repaired}`);

    try {
      return this.acceptPlan(repaired.result);
    } catch (error) {
      // A2.2: FAIL CLEANLY after repair attempt
      console.log(`[KLAW][ARCHITECT] Plan validation failed: ${error.message}`);
      throw new KlawError({
        code: 'VALIDATION_ERROR',
        provider: 'architect',
        stage: 'plan',
        message: error.message
      });
    }
  }

  async requestPlan(task, context = {}) {
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
        `Config: ${JSON.stringify(context.config || {}, null, 2)}`
      ].join('\n\n')
    });
  }

  acceptPlan(plan) {
    // validatePlan() throws KlawError on invalid - validation is source of truth
    const normalized = validatePlan(plan);
    console.log(`[KLAW][ARCHITECT] ${normalized.summary}`);
    appendMemory('architect', `Planned ${normalized.steps.length} steps: ${normalized.summary}`);
    return normalized;
  }
}

module.exports = ArchitectAgent;
module.exports.validatePlan = validatePlan;