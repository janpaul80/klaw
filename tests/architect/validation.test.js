/**
 * A2.1 Architect Schema Validation Tests
 * Validates that schema validation catches errors correctly
 */
const { validatePlanSchema, normalizePlan } = require('../../src/agents/architect-schema');
const { KlawError } = require('../../src/errors/klaw-error');

console.log('=== A2.1 Architect Validation Tests ===\n');

const testCases = [
  {
    name: 'Valid plan passes',
    plan: {
      summary: 'Create a hello world Node.js script',
      projectType: 'node',
      steps: [
        {
          id: 'step-1',
          agent: 'writer',
          title: 'Create hello.js',
          description: 'Create hello world script',
          task: 'Create hello world script',
          files: [{ path: 'hello.js', content: 'console.log("Hello World");' }],
          commands: []
        }
      ]
    },
    expectValid: true
  },
  {
    name: 'Missing summary fails',
    plan: {
      projectType: 'node',
      steps: [{ id: 'step-1', agent: 'shell', title: 'Test', description: 'Test', task: 'Test', commands: ['echo test'] }]
    },
    expectValid: false
  },
  {
    name: 'Missing projectType fails',
    plan: {
      summary: 'Test project',
      steps: [{ id: 'step-1', agent: 'shell', title: 'Test', description: 'Test', task: 'Test', commands: ['echo test'] }]
    },
    expectValid: false
  },
  {
    name: 'Missing steps fails',
    plan: {
      summary: 'Test project',
      projectType: 'node'
    },
    expectValid: false
  },
  {
    name: 'Steps not array fails',
    plan: {
      summary: 'Test project',
      projectType: 'node',
      steps: 'not-an-array'
    },
    expectValid: false
  },
  {
    name: 'Empty steps fails',
    plan: {
      summary: 'Test project',
      projectType: 'node',
      steps: []
    },
    expectValid: false
  },
  {
    name: 'Malformed JSON fails cleanly',
    plan: null,
    expectValid: false,
    isMalformed: true
  },
  {
    name: 'Empty response fails cleanly',
    plan: {},
    expectValid: false
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    const result = validatePlanSchema(tc.plan);
    const actualValid = result.valid;

    if (actualValid === tc.expectValid) {
      console.log(`PASS: ${tc.name}`);
      passed++;
    } else {
      console.log(`FAIL: ${tc.name} — expected ${tc.expectValid}, got ${actualValid}`);
      console.log(`  Errors: ${result.errors?.join('; ')}`);
      failed++;
    }
  } catch (err) {
    if (tc.expectValid === false && err instanceof KlawError) {
      console.log(`PASS: ${tc.name} — KlawError raised correctly`);
      console.log(`  Error: ${err.message}`);
      passed++;
    } else {
      console.log(`FAIL: ${tc.name} — unexpected error: ${err.message}`);
      failed++;
    }
  }
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed > 0) {
  console.log('\nVALIDATION TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nALL VALIDATION TESTS PASSED');
}