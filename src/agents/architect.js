const { appendMemory } = require('../memory');

class ArchitectAgent {
  constructor(provider) {
    this.provider = provider;
  }

  async plan(task) {
    console.log(`[KLAW][ARCHITECT] Planning: ${task}`);
    const plan = await this.provider.generateJson({
      system: [
        'You are KLAW ArchitectAgent.',
        'Return only JSON with this exact shape:',
        '{"summary":"...","steps":[{"agent":"writer","task":"...","files":[]}]}',
        'Keep plans practical for a local CLI runtime. Include file creation and shell setup steps when needed.'
      ].join('\n'),
      prompt: `User task: ${task}`
    });

    if (!plan || typeof plan.summary !== 'string' || !Array.isArray(plan.steps)) {
      throw new Error('ArchitectAgent returned an invalid plan shape');
    }

    for (const step of plan.steps) {
      if (!step.agent || !step.task || !Array.isArray(step.files)) {
        throw new Error('ArchitectAgent returned a step without agent, task, or files');
      }
    }

    console.log(`[KLAW][ARCHITECT] ${plan.summary}`);
    appendMemory('plan', JSON.stringify(plan));
    return plan;
  }
}

module.exports = ArchitectAgent;
