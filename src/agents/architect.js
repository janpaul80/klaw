const { appendMemory } = require('../memory');

function validatePlan(plan) {
  if (!plan || typeof plan.summary !== 'string' || !Array.isArray(plan.steps)) {
    throw new Error('ArchitectAgent returned an invalid plan shape');
  }

  const normalized = {
    summary: plan.summary,
    projectType: typeof plan.projectType === 'string' ? plan.projectType : 'unknown',
    steps: plan.steps.map((step, index) => {
      const id = step.id || `step-${index + 1}`;
      const task = step.task || step.description || step.title;
      const title = step.title || task;
      const description = step.description || task;
      const files = Array.isArray(step.files) ? step.files : [];
      const commands = Array.isArray(step.commands) ? step.commands : [];

      if (!step.agent || !task || !title || !description) {
        throw new Error(`ArchitectAgent returned invalid step ${index + 1}`);
      }

      if (!['writer', 'shell', 'fixer'].includes(step.agent)) {
        throw new Error(`ArchitectAgent returned unsupported agent "${step.agent}"`);
      }

      if (step.agent === 'shell' && commands.length === 0) {
        throw new Error(`ArchitectAgent shell step ${id} has no commands`);
      }

      return {
        id,
        agent: step.agent,
        title,
        description,
        task,
        files,
        commands
      };
    })
  };

  if (normalized.steps.length === 0) {
    throw new Error('ArchitectAgent returned no steps');
  }

  return normalized;
}

class ArchitectAgent {
  constructor(provider) {
    this.provider = provider;
  }

  async plan(task, context = {}) {
    console.log(`[KLAW][ARCHITECT] Planning: ${task}`);
    const first = await this.requestPlan(task, context);

    try {
      return this.acceptPlan(first);
    } catch (error) {
      console.log(`[KLAW][ARCHITECT] Plan validation failed: ${error.message}`);
      const repaired = await this.provider.generateJson({
        system: [
          'You are KLAW ArchitectAgent.',
          'Repair the previous response into valid JSON only.',
          'Required shape:',
          '{"summary":"...","projectType":"nextjs|node|static|unknown","steps":[{"id":"step-1","agent":"writer|shell","title":"...","description":"...","task":"...","files":[],"commands":[]}]}',
          'Shell steps must include commands. Writer steps must include files when known.'
        ].join('\n'),
        prompt: `User task: ${task}\nInvalid plan:\n${JSON.stringify(first, null, 2)}\nValidation error: ${error.message}`
      });
      return this.acceptPlan(repaired);
    }
  }

  async requestPlan(task, context) {
    return this.provider.generateJson({
      system: [
        'You are KLAW ArchitectAgent.',
        'Return only JSON with this exact shape:',
        '{"summary":"...","projectType":"nextjs|node|static|unknown","steps":[{"id":"step-1","agent":"writer|shell","title":"...","description":"...","task":"...","files":[],"commands":[]}]}',
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
    const normalized = validatePlan(plan);
    console.log(`[KLAW][ARCHITECT] ${normalized.summary}`);
    appendMemory('architect', `Planned ${normalized.steps.length} steps: ${normalized.summary}`);
    return normalized;
  }
}

module.exports = ArchitectAgent;
module.exports.validatePlan = validatePlan;
