/**
 * A2.3 Architect Retry Strategy Tests
 * Validates retry logic and error classification
 */
const { classifyArchitectError } = require('../../src/agents/architect');
const { KlawError } = require('../../src/errors/klaw-error');

console.log('=== A2.3 Retry Strategy Tests ===\n');

const testCases = [
  // Retryable errors
  {
    name: 'VALIDATION_ERROR retries',
    error: new KlawError({ code: 'VALIDATION_ERROR', provider: 'architect', stage: 'validation', message: 'Invalid plan' }),
    expectRetryable: true
  },
  {
    name: 'EMPTY_RESPONSE retries',
    error: new KlawError({ code: 'EMPTY_RESPONSE', provider: 'architect', stage: 'complete', message: 'Empty response' }),
    expectRetryable: true
  },
  {
    name: 'PROVIDER_ERROR retries',
    error: new KlawError({ code: 'PROVIDER_ERROR', provider: 'openai', stage: 'complete', message: 'HTTP 500' }),
    expectRetryable: true
  },
  {
    name: 'INVALID_JSON retries',
    error: new KlawError({ code: 'INVALID_JSON', provider: 'openai', stage: 'generateJson', message: 'Invalid JSON' }),
    expectRetryable: true
  },
  // Non-retryable errors
  {
    name: 'MISSING_API_KEY does not retry',
    error: new KlawError({ code: 'MISSING_API_KEY', provider: 'openai', stage: 'complete', message: 'Missing OPENAI_API_KEY' }),
    expectRetryable: false
  },
  {
    name: '401 does not retry',
    error: new Error('HTTP 401: invalid API key'),
    expectRetryable: false
  },
  {
    name: '403 does not retry',
    error: new Error('HTTP 403: forbidden'),
    expectRetryable: false
  },
  {
    name: 'quota exceeded does not retry',
    error: new Error('quota exceeded'),
    expectRetryable: false
  },
  {
    name: 'billing error does not retry',
    error: new Error('billing error'),
    expectRetryable: false
  },
  {
    name: 'null error does not retry',
    error: null,
    expectRetryable: false
  },
  {
    name: 'validation error with missing field is retryable',
    error: new KlawError({ code: 'VALIDATION_ERROR', provider: 'architect', stage: 'validation', message: 'Missing required field: projectType' }),
    expectRetryable: true
  },
  {
    name: 'validation error is validation_error',
    error: new KlawError({ code: 'VALIDATION_ERROR', provider: 'architect', stage: 'validation', message: 'Invalid plan' }),
    expectRetryable: true
  },
  {
    name: 'empty response error is retryable',
    error: new KlawError({ code: 'EMPTY_RESPONSE', provider: 'openai', stage: 'complete', message: 'The response was empty' }),
    expectRetryable: true
  }
];

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = classifyArchitectError(tc.error);
  const actualRetryable = result.retryable;

  if (actualRetryable === tc.expectRetryable) {
    console.log(`PASS: ${tc.name} → ${result.reason}`);
    passed++;
  } else {
    console.log(`FAIL: ${tc.name} → expected retryable=${tc.expectRetryable}, got ${actualRetryable} (${result.reason})`);
    failed++;
  }
}

console.log(`\n=== Results ===`);
console.log(`Passed: ${passed}/${testCases.length}`);
console.log(`Failed: ${failed}/${testCases.length}`);

if (failed > 0) {
  console.log('\nRETRY TESTS FAILED');
  process.exit(1);
} else {
  console.log('\nALL RETRY TESTS PASSED');
}