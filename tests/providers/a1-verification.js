/**
 * A1 Provider Verification Script
 * Validates all providers implement the BaseProvider contract
 */
const { createProvider, providers } = require('../../src/providers');

console.log('=== A1 Provider Verification ===\n');

// Test each provider
const providerNames = Object.keys(providers);
const results = [];

async function runVerification() {
  for (const name of providerNames) {
    console.log(`\n--- ${name} ---`);

    try {
      // Test 1: validateConfig with empty config to test validation
      const provider = createProvider({ provider: name, apiKey: 'TEST_KEY' });
      const validation = provider.validateConfig();
      console.log(`validateConfig(): ${JSON.stringify(validation)}`);

      // Test 2: healthCheck
      const health = await provider.healthCheck();
      console.log(`healthCheck(): ${JSON.stringify(health)}`);

      // Test 3: verify required methods exist
      const hasComplete = typeof provider.complete === 'function';
      const hasGenerateJson = typeof provider.generateJson === 'function';
      const hasValidateConfig = typeof provider.validateConfig === 'function';
      const hasHealthCheck = typeof provider.healthCheck === 'function';

      console.log(`Methods: complete=${hasComplete}, generateJson=${hasGenerateJson}, validateConfig=${hasValidateConfig}, healthCheck=${hasHealthCheck}`);

      results.push({ name, status: 'OK', validation, health, methods: { complete: hasComplete, generateJson: hasGenerateJson, validateConfig: hasValidateConfig, healthCheck: hasHealthCheck } });
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      results.push({ name, status: 'ERROR', error: e.message });
    }
  }

  console.log('\n=== Summary ===');
  for (const r of results) {
    console.log(`${r.name}: ${r.status}`);
  }

  console.log('\n=== Validation Shape Check ===');
  for (const r of results) {
    if (r.validation) {
      const shapeOk = r.validation.valid !== undefined && Array.isArray(r.validation.errors);
      console.log(`${r.name} validateConfig shape: ${shapeOk ? 'OK' : 'FAIL'}`);
    }
  }

  console.log('\n=== HealthCheck Shape Check ===');
  for (const r of results) {
    if (r.health) {
      const shapeOk = r.health.ok !== undefined && typeof r.health.message === 'string';
      console.log(`${r.name} healthCheck shape: ${shapeOk ? 'OK' : 'FAIL'}`);
    }
  }
}

runVerification().catch(e => console.error('Verification failed:', e.message));