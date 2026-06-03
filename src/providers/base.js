/**
 * BaseProvider
 * Defines the minimal interface every provider must implement.
 * Implementations should extend this class for consistency.
 */

const { KlawError } = require('../errors/klaw-error');

class BaseProvider {
  constructor({ apiKey, model, name, baseUrl }) {
    this.apiKey = apiKey;
    this.model = model;
    this.name = name;
    this.baseUrl = baseUrl;
  }

  async complete(prompt, opts = {}) {
    throw new KlawError({
      code: 'NOT_IMPLEMENTED',
      provider: this.name,
      stage: 'complete',
      message: 'complete() not implemented'
    });
  }

  async stream(prompt, onToken, opts = {}) {
    throw new KlawError({
      code: 'NOT_IMPLEMENTED',
      provider: this.name,
      stage: 'stream',
      message: 'stream() not implemented'
    });
  }

  validateConfig() {
    return { valid: false, errors: ['validateConfig() not implemented'] };
  }

  async healthCheck() {
    return { ok: false, message: 'healthCheck() not implemented' };
  }
}

module.exports = { BaseProvider };