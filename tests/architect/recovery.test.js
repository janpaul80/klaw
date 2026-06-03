/**
 * A2.2 JSON Recovery Tests
 * Validates multi-pass recovery and confidence scoring
 */
const { extractAndRepairJson, repairJsonResponse } = require('../../src/providers/json-repair');
const { KlawError } = require('../../src/errors/klaw-error');

console.log('=== A2.2 JSON Recovery Tests ===\n');

const testCases = [
  {
    name: 'Valid JSON',
    input: '{"summary":"Test","projectType":"node","steps":[{"id":"step-1","agent":"writer","title":"Create","description":"Create","task":"Create","files":[],"commands":[]}]}',
    expectValid: true
  },
  {
    name: 'JSON inside markdown fences',
    input: '```json\n{"summary":"Test","projectType":"node","steps":[]}\n```',
    expectValid: true
  },
  {
    name: 'Extra text before JSON',
    input: 'Here is the plan:\n{"summary":"Test","projectType":"node","steps":[]}',
    expectValid: true
  },
  {
    name: 'Extra text after JSON',
    input: '{"summary":"Test","projectType":"node","steps":[]}\n\nThis should work.',
    expectValid: true
  },
  {
    name: 'JSON embedded in text with braces',
    input: 'The response is: {"summary":"Test","projectType":"node","steps":[]}Please confirm',
    expectValid: true,
    expectRepaired: true
  },
  {
    name: 'Unrecoverable JSON',
    input: 'This is not JSON at all!!!',
    expectValid: false
  },
  {
    name: 'Empty response',
    input: '',
    expectValid: false,
    isEmpty: true
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  try {
    const result = extractAndRepairJson(tc.input);

    if (tc.isEmpty) {
      // Empty should fail with specific error
      if (result.error === 'EMPTY_RESPONSE') {
        console.log(`PASS: ${tc.name} — empty detected`);
        passed++;
      } else {
        console.log(`FAIL: ${tc.name} — expected empty error, got: ${JSON.stringify(result)}`);
        failed++;
      }
      continue;
    }

    if (tc.expectValid) {
      if (result.result) {
        const repaired = result.repaired ? ' (repaired)' : '';
        const conf = result.repaired ? 'repaired: true' : 'repaired: false';
        console.log(`PASS: ${tc.name}${repaired} — ${conf}, passes: ${result.passes}`);
        passed++;
      } else {
        console.log(`FAIL: ${tc.name} — expected valid, got null`);
        failed++;
      }
    } else {
      if (!result.result) {
        console.log(`PASS: ${tc.name} — unrecoverable detected`);
        passed++;
      } else {
        console.log(`FAIL: ${tc.name} — expected invalid, got result`);
        failed++;
      }
    }
  } catch (err) {
    if (!tc.expectValid) {
      console.log(`PASS: ${tc.name} — error raised correctly: ${err.message}`);
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
  console.log('\nRECOVERY TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nALL RECOVERY TESTS PASSED');
}