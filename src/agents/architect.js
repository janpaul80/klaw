class ArchitectAgent {
  constructor(task) {
    this.task = task;
    this.steps = [];
  }

  analyze() {
    const lower = this.task.toLowerCase();
    this.steps = [];

    if (lower.includes('next.js') || lower.includes('next app') || lower.includes('landing page')) {
      this.steps = [
        'Create package.json with Next.js dependencies',
        'Generate app structure (pages/api)',
        'Install dependencies',
        'Start development server'
      ];
    } else if (lower.includes('react') || lower.includes('component')) {
      this.steps = [
        'Create component file',
        'Add to project structure',
        'Install required packages'
      ];
    } else {
      this.steps = [
        'Analyze task requirements',
        'Create necessary files',
        'Install dependencies if needed',
        'Set up project structure'
      ];
    }

    return this.steps;
  }

  log(reasoning) {
    console.log(`[KLAW][ARCHITECT] ${reasoning}`);
    appendMemory('reasoning', `ArchitectAgent: ${reasoning}`);
  }

  delegate(agent, step) {
    console.log(`[KLAW][ARCHITECT] Delegating to ${agent}: ${step}`);
    appendMemory('action', `[${agent}] ${step}`);
  }
}

module.exports = ArchitectAgent;