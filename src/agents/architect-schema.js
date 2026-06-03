/**
 * Architect Output Schema
 * Strict validation for Architect agent plan output
 */

const { KlawError } = require('../errors/klaw-error');

const PLAN_SCHEMA = {
  required: ['summary', 'projectType', 'steps'],
  properties: {
    summary: { type: 'string', minLength: 1 },
    projectType: { type: 'string', enum: ['nextjs', 'node', 'static', 'cli', 'unknown'] },
    steps: { type: 'array', minLength: 1 }
  }
};

const STEP_SCHEMA = {
  required: ['id', 'agent', 'title', 'description', 'task'],
  properties: {
    id: { type: 'string', minLength: 1 },
    agent: { type: 'string', enum: ['writer', 'shell', 'fixer'] },
    title: { type: 'string', minLength: 1 },
    description: { type: 'string', minLength: 1 },
    task: { type: 'string', minLength: 1 },
    files: { type: 'array' },
    commands: { type: 'array' }
  }
};

/**
 * Validate a plan object against the strict schema
 * @param {Object} plan - Plan object to validate
 * @returns {{valid: boolean, errors: string[]}}
 */
function validatePlanSchema(plan) {
  const errors = [];

  if (!plan || typeof plan !== 'object') {
    return { valid: false, errors: ['Plan must be an object'] };
  }

  // Check required fields
  if (typeof plan.summary !== 'string' || !plan.summary.trim()) {
    errors.push('Missing or invalid required field: summary');
  }

  if (typeof plan.projectType !== 'string' || !['nextjs', 'node', 'static', 'cli', 'unknown'].includes(plan.projectType)) {
    errors.push('Missing or invalid required field: projectType (must be: nextjs, node, static, cli, unknown)');
  }

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push('Missing or invalid required field: steps (must be non-empty array)');
  }

  // Validate each step
  if (Array.isArray(plan.steps)) {
    plan.steps.forEach((step, index) => {
      if (!step.id) errors.push(`Step ${index + 1}: missing id`);
      if (!['writer', 'shell', 'fixer'].includes(step.agent)) {
        errors.push(`Step ${index + 1}: invalid agent (must be: writer, shell, fixer)`);
      }
      if (!step.title) errors.push(`Step ${index + 1}: missing title`);
      if (!step.description) errors.push(`Step ${index + 1}: missing description`);
      if (!step.task) errors.push(`Step ${index + 1}: missing task`);

      // Shell steps require commands
      if (step.agent === 'shell' && (!Array.isArray(step.commands) || step.commands.length === 0)) {
        errors.push(`Step ${index + 1}: shell step requires commands`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Normalize a plan from any provider response shape
 * @param {Object} plan - Raw plan from provider
 * @returns {Object} Normalized plan
 */
function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    return null;
  }

  // Ensure steps is an array
  const steps = Array.isArray(plan.steps) ? plan.steps : [];

  return {
    summary: String(plan.summary || '').trim(),
    projectType: String(plan.projectType || 'unknown').toLowerCase(),
    steps: steps.map((step, index) => ({
      id: step.id || `step-${index + 1}`,
      agent: step.agent || 'shell',
      title: step.title || step.description || step.task || 'Untitled step',
      description: step.description || step.task || step.title || '',
      task: step.task || step.description || step.title || '',
      files: Array.isArray(step.files) ? step.files : [],
      commands: Array.isArray(step.commands) ? step.commands : []
    }))
  };
}

module.exports = {
  PLAN_SCHEMA,
  STEP_SCHEMA,
  validatePlanSchema,
  normalizePlan
};